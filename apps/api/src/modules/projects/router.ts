import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { createContribution, createTx, store } from '../../db/store';
import { enqueueTonEvent } from '../indexer/worker';
import { verifyWalletAuth } from '../wallet/auth';
import { getProjectProgress, getProjects, invalidateProjectCache } from './service';

const createProjectSchema = z.object({
  name: z.string().min(2),
  description: z.string().min(5),
  hardCap: z.string().min(1),
  softCap: z.string().min(1),
  tokenSymbol: z.string().min(1),
  tokenPrice: z.string().min(1),
  totalSupply: z.string().min(1),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
});

const buySchema = z.object({ amount: z.string().min(1) });

export const projectsRouter = Router();

projectsRouter.post('/', verifyWalletAuth('create-project'), (req, res) => {
  const payload = createProjectSchema.safeParse(req.body);
  if (!payload.success) {
    return res.status(400).json({ error: payload.error.flatten() });
  }

  const owner = store.getOrCreateUser(req.wallet!.walletAddress, 'founder');
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
  });

  invalidateProjectCache(project.id);
  return res.status(201).json({ project, sale });
});

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
  return res.json({ project, sale, progress });
});

projectsRouter.post('/:id/buy', verifyWalletAuth('buy-project'), (req, res) => {
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

  const user = store.getOrCreateUser(req.wallet!.walletAddress, 'investor');
  const contribution = createContribution({
    projectId: project.id,
    saleId: sale.id,
    userId: user.id,
    amount: payload.data.amount,
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
    amount: payload.data.amount,
    status: 'pending',
    metadata: { walletAddress: user.walletAddress },
  });

  enqueueTonEvent({
    type: 'ContributionConfirmed',
    projectId: project.id,
    contributionId: contribution.id,
    userId: user.id,
    txHash,
    amount: payload.data.amount,
  });

  invalidateProjectCache(project.id);
  return res.status(202).json({ contributionId: contribution.id, txHash, status: 'queued' });
});

projectsRouter.post('/:id/finalize', verifyWalletAuth('finalize-project'), (req, res) => {
  const projectId = String(req.params.id);
  const project = store.projects.get(projectId);
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }

  enqueueTonEvent({
    type: 'SaleFinalized',
    projectId: project.id,
    txHash: `ton_${randomUUID().replaceAll('-', '')}`,
    amount: '0',
  });

  invalidateProjectCache(project.id);
  return res.json({ projectId: project.id, status: 'finalization_queued' });
});

projectsRouter.post('/:id/refund', verifyWalletAuth('refund-project'), (req, res) => {
  const projectId = String(req.params.id);
  const contribution = [...store.contributions.values()].find((item) => item.projectId === projectId && item.status === 'confirmed');

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
});
