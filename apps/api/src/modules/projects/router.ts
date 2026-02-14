import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { createRateLimiter } from '../../middleware/rate-limit';
import { auditCriticalAction } from '../../middleware/audit-log';
import { requireRole } from '../../middleware/require-role';
import { createContribution, createTx, store } from '../../db/store';
import { enqueueTonEvent } from '../indexer/worker';
import { verifyWalletAuth } from '../wallet/auth';
import { getProjectProgress, getProjects, invalidateProjectCache } from './service';

const createProjectSchema = z
  .object({
    name: z.string().min(2).max(64),
    description: z.string().min(5).max(512),
    hardCap: z.string().regex(/^\d+$/),
    softCap: z.string().regex(/^\d+$/),
    tokenSymbol: z.string().min(1).max(16),
    tokenPrice: z.string().regex(/^\d+(\.\d+)?$/),
    totalSupply: z.string().regex(/^\d+$/),
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime(),
    teamVesting: z
      .object({
        enabled: z.boolean(),
        cliffSeconds: z.number().int().nonnegative().default(0),
        durationSeconds: z.number().int().nonnegative().default(0),
        unlockStartAt: z.string().datetime().optional(),
      })
      .default({ enabled: false, cliffSeconds: 0, durationSeconds: 0 }),
    liquidityLock: z
      .object({
        enabled: z.boolean(),
        lockUntil: z.string().datetime().optional(),
      })
      .default({ enabled: false }),
    buyLimits: z
      .object({
        minBuyAmount: z.string().regex(/^\d+(\.\d+)?$/),
        maxBuyAmount: z.string().regex(/^\d+(\.\d+)?$/),
      })
      .optional(),
    whitelist: z
      .object({
        enabled: z.boolean(),
        addresses: z.array(z.string().min(4)).max(10_000).default([]),
      })
      .default({ enabled: false, addresses: [] }),
  })
  .superRefine((value, ctx) => {
    if (Number(value.softCap) > Number(value.hardCap)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'softCap must be <= hardCap',
        path: ['softCap'],
      });
    }

    if (new Date(value.endsAt) <= new Date(value.startsAt)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'endsAt must be after startsAt',
        path: ['endsAt'],
      });
    }

    if (value.teamVesting.enabled && value.teamVesting.durationSeconds <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'team vesting duration must be > 0',
        path: ['teamVesting', 'durationSeconds'],
      });
    }

    if (value.liquidityLock.enabled && !value.liquidityLock.lockUntil) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'lockUntil is required when liquidity lock is enabled',
        path: ['liquidityLock', 'lockUntil'],
      });
    }

    if (value.buyLimits) {
      if (Number(value.buyLimits.minBuyAmount) > Number(value.buyLimits.maxBuyAmount)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'minBuyAmount must be <= maxBuyAmount',
          path: ['buyLimits', 'minBuyAmount'],
        });
      }

      if (Number(value.buyLimits.maxBuyAmount) > Number(value.hardCap)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'maxBuyAmount must be <= hardCap',
          path: ['buyLimits', 'maxBuyAmount'],
        });
      }
    }
  });

const buySchema = z.object({ amount: z.string().regex(/^\d+(\.\d+)?$/) });
const updateWhitelistSchema = z.object({
  addresses: z.array(z.string().min(4)).max(10_000),
});

export const projectsRouter = Router();

const isProjectOwner = (projectOwnerId: string, walletAddress: string) => {
  const owner = store.users.get(projectOwnerId);
  return owner?.walletAddress === walletAddress;
};

const getProjectSalePair = (projectId: string) => {
  const project = store.projects.get(projectId);
  const saleId = project ? store.salesByProject.get(project.id) : undefined;
  const sale = saleId ? store.sales.get(saleId) : undefined;
  return { project, sale };
};

const canControlSale = (
  projectOwnerId: string,
  walletAddress: string,
  role: 'founder' | 'investor' | 'admin',
) => role === 'admin' || isProjectOwner(projectOwnerId, walletAddress);

const isSaleOpenNow = (startsAt: string, endsAt: string) => {
  const now = Date.now();
  return now >= new Date(startsAt).getTime() && now <= new Date(endsAt).getTime();
};

const getUnlockRatio = (projectId: string) => {
  const { sale } = getProjectSalePair(projectId);
  if (!sale || sale.state !== 'finalized') return 0;
  if (!sale.teamVesting.enabled) return 1;

  const unlockStartAt = sale.teamVesting.unlockStartAt ?? sale.finalizedAt ?? sale.endsAt;
  const unlockStartMs = new Date(unlockStartAt).getTime();
  const cliffMs = sale.teamVesting.cliffSeconds * 1000;
  const durationMs = sale.teamVesting.durationSeconds * 1000;
  const now = Date.now();

  if (now < unlockStartMs + cliffMs) return 0;
  if (durationMs <= 0) return 1;
  const ratio = (now - unlockStartMs) / durationMs;
  return Math.max(0, Math.min(1, ratio));
};

const getUserProjectClaimStats = (projectId: string, userId: string) => {
  const ratio = getUnlockRatio(projectId);
  const contributions = [...store.contributions.values()].filter(
    (item) => item.projectId === projectId && item.userId === userId && item.status !== 'refunded',
  );
  const purchasedAmount = contributions.reduce((sum, item) => sum + Number(item.amount), 0);
  const claimedAmount = contributions.reduce((sum, item) => sum + Number(item.claimedAmount), 0);
  const unlockedAmount = purchasedAmount * ratio;
  const claimableAmount = Math.max(0, unlockedAmount - claimedAmount);

  return {
    purchasedAmount,
    claimedAmount,
    unlockedAmount,
    claimableAmount,
  };
};

const getProjectRisk = (projectId: string) => {
  const { project, sale } = getProjectSalePair(projectId);
  if (!project || !sale) return undefined;

  const contributions = [...store.contributions.values()].filter(
    (item) => item.projectId === project.id && item.status !== 'refunded',
  );
  const walletTotals = new Map<string, number>();
  for (const contribution of contributions) {
    const user = store.users.get(contribution.userId);
    if (!user) continue;
    walletTotals.set(
      user.walletAddress,
      (walletTotals.get(user.walletAddress) ?? 0) + Number(contribution.amount),
    );
  }

  const totals = [...walletTotals.values()];
  const totalContributed = totals.reduce((sum, value) => sum + value, 0);
  const largestWalletAmount = totals.length ? Math.max(...totals) : 0;
  const topWalletShare = totalContributed ? (largestWalletAmount / totalContributed) * 100 : 0;
  const uniqueContributors = walletTotals.size;

  const flags: string[] = [];
  let score = 100;

  if (topWalletShare >= 50) {
    flags.push('whale_concentration_high');
    score -= 35;
  } else if (topWalletShare >= 30) {
    flags.push('whale_concentration_medium');
    score -= 20;
  }

  if (uniqueContributors > 0 && uniqueContributors < 3) {
    flags.push('low_contributor_diversity');
    score -= 15;
  }

  if (sale.whitelistAddresses.length > 0 && sale.whitelistAddresses.length < 4) {
    flags.push('narrow_whitelist');
    score -= 10;
  }

  const now = Date.now();
  const start = new Date(sale.startsAt).getTime();
  const end = new Date(sale.endsAt).getTime();
  const midpoint = start + (end - start) / 2;
  if (now > midpoint && Number(sale.raisedAmount) < Number(project.softCap) * 0.25) {
    flags.push('weak_demand');
    score -= 15;
  }

  if (sale.state === 'paused') {
    flags.push('sale_paused');
    score -= 10;
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    flags,
    topWalletShare: Number(topWalletShare.toFixed(2)),
    uniqueContributors,
    whitelistSize: sale.whitelistAddresses.length,
    contributorsTotalAmount: `${totalContributed}`,
  };
};

projectsRouter.post(
  '/',
  createRateLimiter('create-project', 20, 60_000),
  verifyWalletAuth('create-project'),
  requireRole('founder'),
  auditCriticalAction('create-project'),
  (req, res) => {
    const payload = createProjectSchema.safeParse(req.body);
    if (!payload.success) {
      return res.status(400).json({ error: payload.error.flatten() });
    }

    const owner = store.getOrCreateUser(req.wallet!.walletAddress, req.wallet!.role);
    const project = store.createProject({
      ownerId: owner.id,
      name: payload.data.name,
      description: payload.data.description,
      hardCap: payload.data.hardCap,
      softCap: payload.data.softCap,
    });

    const sale = store.createSale({
      projectId: project.id,
      tokenSymbol: payload.data.tokenSymbol,
      tokenPrice: payload.data.tokenPrice,
      totalSupply: payload.data.totalSupply,
      startsAt: payload.data.startsAt,
      endsAt: payload.data.endsAt,
      teamVesting: payload.data.teamVesting,
      liquidityLock: payload.data.liquidityLock,
      minBuyAmount: payload.data.buyLimits?.minBuyAmount ?? '1',
      maxBuyAmount: payload.data.buyLimits?.maxBuyAmount ?? payload.data.hardCap,
      whitelistAddresses: payload.data.whitelist.enabled
        ? [...new Set(payload.data.whitelist.addresses)]
        : [],
    });

    invalidateProjectCache(project.id);
    return res.status(201).json({ project, sale });
  },
);

projectsRouter.get('/', (req, res) => {
  const sort = Array.isArray(req.query.sort) ? req.query.sort[0] : req.query.sort;
  const kind = sort === 'trending' || sort === 'new' ? sort : 'all';
  return res.json(getProjects(kind));
});

projectsRouter.get('/:id', (req, res) => {
  const projectId = String(req.params.id);
  const project = store.projects.get(projectId);
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }

  const saleId = store.salesByProject.get(project.id);
  const sale = saleId ? store.sales.get(saleId) : undefined;
  const progress = getProjectProgress(project.id);
  const risk = getProjectRisk(project.id);
  return res.json({ project, sale, progress, risk });
});

projectsRouter.get('/:id/risk', (req, res) => {
  const projectId = String(req.params.id);
  const risk = getProjectRisk(projectId);
  if (!risk) {
    return res.status(404).json({ error: 'Project not found' });
  }
  return res.json({ projectId, risk });
});

projectsRouter.get(
  '/:id/claimable',
  createRateLimiter('claimable-project', 30, 60_000),
  verifyWalletAuth('claimable-project'),
  (req, res) => {
    const projectId = String(req.params.id);
    const { project, sale } = getProjectSalePair(projectId);
    if (!project || !sale) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const user = store.getOrCreateUser(req.wallet!.walletAddress, req.wallet!.role);
    const stats = getUserProjectClaimStats(project.id, user.id);
    return res.json({
      projectId: project.id,
      saleState: sale.state,
      purchasedAmount: `${stats.purchasedAmount}`,
      claimedAmount: `${stats.claimedAmount}`,
      unlockedAmount: `${stats.unlockedAmount}`,
      claimableAmount: `${stats.claimableAmount}`,
    });
  },
);

projectsRouter.post(
  '/:id/buy',
  createRateLimiter('buy-project', 30, 60_000),
  verifyWalletAuth('buy-project'),
  auditCriticalAction('buy-project'),
  (req, res) => {
    const payload = buySchema.safeParse(req.body);
    if (!payload.success) {
      return res.status(400).json({ error: payload.error.flatten() });
    }

    const projectId = String(req.params.id);
    const project = store.projects.get(projectId);
    const saleId = store.salesByProject.get(projectId);
    const sale = saleId ? store.sales.get(saleId) : undefined;
    if (!project || !sale) {
      return res.status(404).json({ error: 'Project not found' });
    }
    if (project.status !== 'active' || sale.state !== 'active') {
      return res.status(409).json({ error: 'Sale is not active' });
    }
    if (
      sale.whitelistAddresses.length &&
      !sale.whitelistAddresses.includes(req.wallet!.walletAddress)
    ) {
      return res.status(403).json({ error: 'Wallet is not whitelisted for this sale' });
    }
    if (!isSaleOpenNow(sale.startsAt, sale.endsAt)) {
      return res.status(409).json({ error: 'Sale is not currently open' });
    }

    const buyAmount = Number(payload.data.amount);
    if (buyAmount < Number(sale.minBuyAmount) || buyAmount > Number(sale.maxBuyAmount)) {
      return res
        .status(400)
        .json({ error: `Amount must be between ${sale.minBuyAmount} and ${sale.maxBuyAmount}` });
    }
    if (Number(sale.raisedAmount) + buyAmount > Number(project.hardCap)) {
      return res.status(400).json({ error: 'Amount exceeds remaining hard cap' });
    }

    const user = store.getOrCreateUser(req.wallet!.walletAddress, req.wallet!.role);
    const existingContributionAmount = [...store.contributions.values()]
      .filter(
        (item) =>
          item.projectId === project.id && item.userId === user.id && item.status !== 'refunded',
      )
      .reduce((sum, item) => sum + Number(item.amount), 0);

    if (existingContributionAmount + buyAmount > Number(sale.maxBuyAmount)) {
      return res.status(400).json({ error: 'Per-wallet max allocation exceeded' });
    }

    const contribution = createContribution({
      projectId: project.id,
      saleId: sale.id,
      userId: user.id,
      amount: `${buyAmount}`,
      status: 'pending',
    });

    const txHash = `ton_${randomUUID().replaceAll('-', '')}`;
    createTx({
      projectId: project.id,
      contributionId: contribution.id,
      userId: user.id,
      txHash,
      direction: 'in',
      eventType: 'ContributionSubmitted',
      amount: `${buyAmount}`,
      status: 'pending',
      metadata: { walletAddress: user.walletAddress },
    });

    enqueueTonEvent({
      type: 'ContributionConfirmed',
      projectId: project.id,
      contributionId: contribution.id,
      userId: user.id,
      txHash,
      amount: `${buyAmount}`,
    });

    invalidateProjectCache(project.id);
    return res.status(202).json({ contributionId: contribution.id, txHash, status: 'queued' });
  },
);

projectsRouter.post(
  '/:id/claim',
  createRateLimiter('claim-project', 20, 60_000),
  verifyWalletAuth('claim-project'),
  auditCriticalAction('claim-project'),
  (req, res) => {
    const projectId = String(req.params.id);
    const { project, sale } = getProjectSalePair(projectId);
    if (!project || !sale) {
      return res.status(404).json({ error: 'Project not found' });
    }
    if (sale.state !== 'finalized') {
      return res.status(409).json({ error: 'Claiming is available only for finalized sales' });
    }

    const user = store.getOrCreateUser(req.wallet!.walletAddress, req.wallet!.role);
    const stats = getUserProjectClaimStats(project.id, user.id);
    if (stats.claimableAmount <= 0) {
      return res.status(409).json({ error: 'No claimable amount available' });
    }

    let remaining = stats.claimableAmount;
    const contributionList = [...store.contributions.values()]
      .filter(
        (item) =>
          item.projectId === project.id && item.userId === user.id && item.status !== 'refunded',
      )
      .sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));

    for (const contribution of contributionList) {
      if (remaining <= 0) break;
      const available = Number(contribution.amount) - Number(contribution.claimedAmount);
      if (available <= 0) continue;
      const delta = Math.min(available, remaining);
      contribution.claimedAmount = `${Number(contribution.claimedAmount) + delta}`;
      contribution.updatedAt = new Date().toISOString();
      remaining -= delta;
    }

    const claimedAmount = stats.claimableAmount - Math.max(0, remaining);
    const txHash = `ton_${randomUUID().replaceAll('-', '')}`;
    createTx({
      projectId: project.id,
      userId: user.id,
      txHash,
      direction: 'out',
      eventType: 'ContributionClaimed',
      amount: `${claimedAmount}`,
      status: 'confirmed',
      metadata: { walletAddress: user.walletAddress },
    });

    invalidateProjectCache(project.id);
    return res.json({ projectId: project.id, txHash, claimedAmount: `${claimedAmount}` });
  },
);

projectsRouter.put(
  '/:id/whitelist',
  createRateLimiter('update-whitelist', 20, 60_000),
  verifyWalletAuth('update-whitelist'),
  auditCriticalAction('update-whitelist'),
  (req, res) => {
    const payload = updateWhitelistSchema.safeParse(req.body);
    if (!payload.success) {
      return res.status(400).json({ error: payload.error.flatten() });
    }

    const projectId = String(req.params.id);
    const { project, sale } = getProjectSalePair(projectId);
    if (!project || !sale) {
      return res.status(404).json({ error: 'Project not found' });
    }
    if (!canControlSale(project.ownerId, req.wallet!.walletAddress, req.wallet!.role)) {
      return res.status(403).json({ error: 'Only project owner or admin can update whitelist' });
    }
    if (sale.state === 'finalized' || sale.state === 'refunded') {
      return res.status(409).json({ error: 'Cannot update whitelist after sale completion' });
    }

    sale.whitelistAddresses = [
      ...new Set(payload.data.addresses.map((address) => address.trim()).filter(Boolean)),
    ];
    sale.updatedAt = new Date().toISOString();
    invalidateProjectCache(project.id);
    return res.json({
      projectId: project.id,
      whitelistEnabled: sale.whitelistAddresses.length > 0,
      whitelistCount: sale.whitelistAddresses.length,
    });
  },
);

projectsRouter.post(
  '/:id/finalize',
  createRateLimiter('finalize-project', 8, 60_000),
  verifyWalletAuth('finalize-project'),
  auditCriticalAction('finalize-project'),
  (req, res) => {
    const projectId = String(req.params.id);
    const { project, sale } = getProjectSalePair(projectId);
    if (!project || !sale) {
      return res.status(404).json({ error: 'Project not found' });
    }
    if (project.status !== 'active' || sale.state !== 'active') {
      return res.status(409).json({ error: 'Project is not finalizable' });
    }

    const role = req.wallet!.role;
    if (!canControlSale(project.ownerId, req.wallet!.walletAddress, role)) {
      return res.status(403).json({ error: 'Only project owner or admin can finalize' });
    }
    if (role !== 'admin') {
      const hitHardCap = Number(sale.raisedAmount) >= Number(project.hardCap);
      const ended = Date.now() > new Date(sale.endsAt).getTime();
      if (!hitHardCap && !ended) {
        return res
          .status(409)
          .json({ error: 'Owner can finalize only after sale end or hard cap reached' });
      }
    }

    enqueueTonEvent({
      type: 'SaleFinalized',
      projectId: project.id,
      txHash: `ton_${randomUUID().replaceAll('-', '')}`,
      amount: '0',
    });

    invalidateProjectCache(project.id);
    return res.json({ projectId: project.id, status: 'finalization_queued' });
  },
);

projectsRouter.post(
  '/:id/refund',
  createRateLimiter('refund-project', 8, 60_000),
  verifyWalletAuth('refund-project'),
  auditCriticalAction('refund-project'),
  (req, res) => {
    const projectId = String(req.params.id);
    const { project, sale } = getProjectSalePair(projectId);
    if (!project || !sale) {
      return res.status(404).json({ error: 'Project not found' });
    }
    if (sale.state !== 'active') {
      return res.status(409).json({ error: 'Sale is not refundable in current state' });
    }

    const role = req.wallet!.role;
    if (!canControlSale(project.ownerId, req.wallet!.walletAddress, role)) {
      return res.status(403).json({ error: 'Only project owner or admin can refund' });
    }

    if (role !== 'admin') {
      const ended = Date.now() > new Date(sale.endsAt).getTime();
      const softCapReached = Number(sale.raisedAmount) >= Number(project.softCap);
      if (!ended || softCapReached) {
        return res
          .status(409)
          .json({ error: 'Owner refund requires sale end and soft-cap failure' });
      }
    }

    const contribution = [...store.contributions.values()].find(
      (item) => item.projectId === projectId && item.status === 'confirmed',
    );

    if (!contribution) {
      return res.status(404).json({ error: 'Confirmed contribution not found for project' });
    }

    enqueueTonEvent({
      type: 'ContributionRefunded',
      projectId: contribution.projectId,
      contributionId: contribution.id,
      userId: contribution.userId,
      txHash: `ton_${randomUUID().replaceAll('-', '')}`,
      amount: contribution.amount,
    });

    invalidateProjectCache(contribution.projectId);
    return res.json({ contributionId: contribution.id, status: 'refund_queued' });
  },
);

projectsRouter.post(
  '/:id/pause',
  createRateLimiter('pause-project', 8, 60_000),
  verifyWalletAuth('pause-project'),
  auditCriticalAction('pause-project'),
  (req, res) => {
    const projectId = String(req.params.id);
    const { project, sale } = getProjectSalePair(projectId);
    if (!project || !sale) {
      return res.status(404).json({ error: 'Project not found' });
    }
    if (!canControlSale(project.ownerId, req.wallet!.walletAddress, req.wallet!.role)) {
      return res.status(403).json({ error: 'Only project owner or admin can pause' });
    }
    if (sale.state !== 'active') {
      return res.status(409).json({ error: 'Only active sales can be paused' });
    }

    sale.state = 'paused';
    sale.updatedAt = new Date().toISOString();
    invalidateProjectCache(project.id);
    return res.json({ projectId: project.id, saleState: sale.state, status: 'paused' });
  },
);

projectsRouter.post(
  '/:id/resume',
  createRateLimiter('resume-project', 8, 60_000),
  verifyWalletAuth('resume-project'),
  auditCriticalAction('resume-project'),
  (req, res) => {
    const projectId = String(req.params.id);
    const { project, sale } = getProjectSalePair(projectId);
    if (!project || !sale) {
      return res.status(404).json({ error: 'Project not found' });
    }
    if (!canControlSale(project.ownerId, req.wallet!.walletAddress, req.wallet!.role)) {
      return res.status(403).json({ error: 'Only project owner or admin can resume' });
    }
    if (sale.state !== 'paused') {
      return res.status(409).json({ error: 'Only paused sales can be resumed' });
    }

    const now = Date.now();
    if (now > new Date(sale.endsAt).getTime()) {
      return res.status(409).json({ error: 'Cannot resume ended sale' });
    }

    sale.state = 'active';
    sale.updatedAt = new Date().toISOString();
    invalidateProjectCache(project.id);
    return res.json({ projectId: project.id, saleState: sale.state, status: 'active' });
  },
);
