import { Router } from 'express';
import { z } from 'zod';
import { auditCriticalAction } from '../../middleware/audit-log';
import { createRateLimiter } from '../../middleware/rate-limit';
import { requireRole } from '../../middleware/require-role';
import { verifyWalletAuth } from '../wallet/auth';
import {
  deploymentConfig,
  deploymentDrift,
  deploymentEnv,
  deploymentHealth,
  opsAnomalyThresholds,
} from '../../config/environments';
import { store } from '../../db/store';
import {
  ackAlert,
  getAlertHistory,
  getAlertState,
  getAlertStatePath,
  muteAlert,
  unmuteAlert,
} from './state';

export const configRouter = Router();

const muteAlertSchema = z.object({
  minutes: z.number().int().min(1).max(10_080).default(60),
  reason: z.string().max(200).optional(),
});
const ackAlertSchema = z.object({ reason: z.string().max(200).optional() });

configRouter.get('/deployment', (_, res) => {
  res.json({
    deploymentEnv,
    ...deploymentConfig,
    health: deploymentHealth,
  });
});

configRouter.get('/drift', (_, res) => {
  const mismatches = deploymentDrift.checks.filter((check) => !check.matches);
  res.json({
    deploymentEnv,
    hasRegistry: deploymentDrift.hasRegistry,
    mismatchCount: mismatches.length,
    severity: mismatches.length === 0 ? 'ok' : mismatches.length === 1 ? 'warning' : 'critical',
    checks: deploymentDrift.checks,
  });
});

configRouter.get('/alerts', (_, res) => {
  const alerts: Array<{
    id: string;
    severity: 'info' | 'warning' | 'critical';
    title: string;
    message: string;
    createdAt: string;
    source: 'deployment' | 'sales' | 'transactions';
  }> = [];

  const now = new Date().toISOString();
  if (!deploymentHealth.hasLaunchFactory) {
    alerts.push({
      id: 'missing-launch-factory',
      severity: 'critical',
      title: 'Missing LaunchFactory address',
      message: 'LaunchFactory contract is not configured for active environment.',
      createdAt: now,
      source: 'deployment',
    });
  }

  if (!deploymentHealth.hasProjectSaleTemplate) {
    alerts.push({
      id: 'missing-project-sale-template',
      severity: 'warning',
      title: 'Missing ProjectSale template',
      message: 'ProjectSale template contract is not configured.',
      createdAt: now,
      source: 'deployment',
    });
  }

  const mismatches = deploymentDrift.checks.filter((check) => !check.matches);
  if (mismatches.length) {
    alerts.push({
      id: 'deployment-drift',
      severity: mismatches.length > 1 ? 'critical' : 'warning',
      title: 'Deployment config drift detected',
      message: `${mismatches.length} contract mapping mismatch(es) between environment config and shared registry.`,
      createdAt: now,
      source: 'deployment',
    });
  }

  const pausedSalesCount = [...store.sales.values()].filter(
    (sale) => sale.state === 'paused',
  ).length;
  if (pausedSalesCount) {
    alerts.push({
      id: 'paused-sales',
      severity: pausedSalesCount > 2 ? 'warning' : 'info',
      title: 'Paused sales detected',
      message: `${pausedSalesCount} sale(s) currently paused.`,
      createdAt: now,
      source: 'sales',
    });
  }

  const recentRefunds = [...store.transactions.values()].filter((tx) => {
    if (tx.eventType !== 'ContributionRefunded') return false;
    return Date.now() - new Date(tx.createdAt).getTime() <= 24 * 60 * 60 * 1000;
  }).length;
  if (recentRefunds) {
    alerts.push({
      id: 'refund-spike',
      severity: recentRefunds >= 3 ? 'critical' : 'warning',
      title: 'Recent refund activity',
      message: `${recentRefunds} refund event(s) recorded in the last 24h.`,
      createdAt: now,
      source: 'transactions',
    });
  }

  const incidents = [...store.transactions.values()]
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
    .slice(0, 12)
    .map((tx) => ({
      id: tx.id,
      type: tx.eventType,
      severity:
        tx.eventType === 'ContributionRefunded'
          ? 'critical'
          : tx.eventType === 'SaleFinalized'
            ? 'info'
            : 'warning',
      message: `${tx.eventType} (${tx.amount} TON)`,
      createdAt: tx.createdAt,
      txHash: tx.txHash,
    }));

  const nowTs = Date.now();
  const decoratedAlerts = alerts.map((alert) => {
    const persisted = getAlertState(alert.id);
    const isMuted = Boolean(
      persisted.mutedUntil && new Date(persisted.mutedUntil).getTime() > nowTs,
    );

    return {
      ...alert,
      acknowledgedAt: persisted.acknowledgedAt ?? null,
      acknowledgedBy: persisted.acknowledgedBy ?? null,
      ackReason: persisted.ackReason ?? null,
      mutedUntil: isMuted ? persisted.mutedUntil! : null,
      mutedBy: persisted.mutedBy ?? null,
      muteReason: persisted.muteReason ?? null,
      active: !isMuted,
    };
  });

  const activeAlerts = decoratedAlerts.filter((alert) => alert.active);
  const severity = activeAlerts.some((alert) => alert.severity === 'critical')
    ? 'critical'
    : activeAlerts.some((alert) => alert.severity === 'warning')
      ? 'warning'
      : 'ok';

  res.json({
    deploymentEnv,
    severity,
    alerts: decoratedAlerts,
    incidents,
    statePath: getAlertStatePath(),
  });
});

configRouter.get('/alerts/history', (req, res) => {
  const limitParam = Number(req.query.limit ?? 50);
  const limit = Number.isFinite(limitParam) ? Math.max(1, Math.min(200, limitParam)) : 50;
  res.json({
    deploymentEnv,
    items: getAlertHistory(limit),
  });
});

configRouter.post(
  '/alerts/:id/ack',
  createRateLimiter('ack-alert', 20, 60_000),
  verifyWalletAuth('ack-alert'),
  requireRole('admin'),
  auditCriticalAction('ack-alert'),
  (req, res) => {
    const payload = ackAlertSchema.safeParse(req.body);
    if (!payload.success) {
      return res.status(400).json({ error: payload.error.flatten() });
    }
    const alertId = String(req.params.id);
    const entry = ackAlert(alertId, req.wallet!.walletAddress, payload.data.reason);
    res.json({
      alertId,
      status: 'acknowledged',
      acknowledgedAt: entry.acknowledgedAt,
      acknowledgedBy: entry.acknowledgedBy,
      reason: entry.ackReason ?? null,
    });
  },
);

configRouter.post(
  '/alerts/:id/mute',
  createRateLimiter('mute-alert', 20, 60_000),
  verifyWalletAuth('mute-alert'),
  requireRole('admin'),
  auditCriticalAction('mute-alert'),
  (req, res) => {
    const payload = muteAlertSchema.safeParse(req.body);
    if (!payload.success) {
      return res.status(400).json({ error: payload.error.flatten() });
    }

    const alertId = String(req.params.id);
    const entry = muteAlert(
      alertId,
      req.wallet!.walletAddress,
      payload.data.minutes,
      payload.data.reason,
    );
    return res.json({
      alertId,
      status: 'muted',
      mutedUntil: entry.mutedUntil,
      mutedBy: entry.mutedBy,
      reason: entry.muteReason ?? null,
    });
  },
);

configRouter.post(
  '/alerts/:id/unmute',
  createRateLimiter('unmute-alert', 20, 60_000),
  verifyWalletAuth('unmute-alert'),
  requireRole('admin'),
  auditCriticalAction('unmute-alert'),
  (req, res) => {
    const alertId = String(req.params.id);
    const entry = unmuteAlert(alertId, req.wallet!.walletAddress);
    res.json({
      alertId,
      status: 'active',
      acknowledgedAt: entry.acknowledgedAt ?? null,
      acknowledgedBy: entry.acknowledgedBy ?? null,
    });
  },
);

configRouter.get('/anomalies', (_, res) => {
  const now = Date.now();
  const HOUR = 60 * 60 * 1000;
  const bucketHours = opsAnomalyThresholds.bucketHours;

  const buckets = Array.from({ length: bucketHours }, (_, index) => {
    const start = now - (bucketHours - index) * HOUR;
    const end = start + HOUR;
    return {
      label: `${bucketHours - index}h_ago`,
      start,
      end,
      buy: 0,
      claim: 0,
      refund: 0,
      finalize: 0,
    };
  });

  for (const tx of store.transactions.values()) {
    const ts = new Date(tx.createdAt).getTime();
    const bucket = buckets.find((item) => ts >= item.start && ts < item.end);
    if (!bucket) continue;

    if (tx.eventType === 'ContributionSubmitted' || tx.eventType === 'ContributionConfirmed') {
      bucket.buy += 1;
    } else if (tx.eventType === 'ContributionClaimed') {
      bucket.claim += 1;
    } else if (tx.eventType === 'ContributionRefunded') {
      bucket.refund += 1;
    } else if (tx.eventType === 'SaleFinalized') {
      bucket.finalize += 1;
    }
  }

  const sum = (field: 'buy' | 'claim' | 'refund' | 'finalize') =>
    buckets.reduce((acc, item) => acc + item[field], 0);

  const totals = {
    buy: sum('buy'),
    claim: sum('claim'),
    refund: sum('refund'),
    finalize: sum('finalize'),
  };

  const recentWindow = buckets.slice(-opsAnomalyThresholds.buyDropoffLookbackHours);
  const recentRefunds = recentWindow.reduce((acc, item) => acc + item.refund, 0);
  const recentBuys = recentWindow.reduce((acc, item) => acc + item.buy, 0);

  const anomalies: Array<{
    id: string;
    severity: 'warning' | 'critical';
    title: string;
    metric: string;
    details: string;
  }> = [];

  if (recentRefunds >= opsAnomalyThresholds.refundWarningCount) {
    anomalies.push({
      id: 'refund-surge',
      severity: recentRefunds >= opsAnomalyThresholds.refundCriticalCount ? 'critical' : 'warning',
      title: 'Refund surge detected',
      metric: `refunds_last_${opsAnomalyThresholds.buyDropoffLookbackHours}h=${recentRefunds}`,
      details: 'Refund velocity exceeds configured baseline threshold.',
    });
  }

  if (recentBuys === 0 && totals.buy > 0) {
    anomalies.push({
      id: 'buy-dropoff',
      severity: 'warning',
      title: 'Buy activity drop-off',
      metric: `buys_last_${opsAnomalyThresholds.buyDropoffLookbackHours}h=${recentBuys}`,
      details: 'No new buy activity in recent window despite historical activity.',
    });
  }

  res.json({
    deploymentEnv,
    windowHours: bucketHours,
    totals,
    buckets: buckets.map((item) => ({
      label: item.label,
      buy: item.buy,
      claim: item.claim,
      refund: item.refund,
      finalize: item.finalize,
    })),
    thresholds: opsAnomalyThresholds,
    anomalies,
  });
});
