import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

interface AlertStateEntry {
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  ackReason?: string;
  mutedUntil?: string;
  mutedBy?: string;
  muteReason?: string;
}

interface AlertHistoryItem {
  id: string;
  alertId: string;
  action: 'ack' | 'mute' | 'unmute';
  actor: string;
  reason?: string;
  createdAt: string;
  mutedUntil?: string;
}

interface OpsAlertsState {
  alerts: Record<string, AlertStateEntry>;
  history: AlertHistoryItem[];
}

const defaultState: OpsAlertsState = { alerts: {}, history: [] };

const resolveStatePath = () => {
  if (process.env.OPS_ALERTS_STATE_FILE) {
    return resolve(process.cwd(), process.env.OPS_ALERTS_STATE_FILE);
  }

  const rootLike = existsSync(resolve(process.cwd(), 'apps'));
  return rootLike
    ? resolve(process.cwd(), 'data/ops-alerts-state.json')
    : resolve(process.cwd(), '../../data/ops-alerts-state.json');
};

const statePath = resolveStatePath();

const readState = (): OpsAlertsState => {
  try {
    if (!existsSync(statePath)) return { ...defaultState };
    const parsed = JSON.parse(readFileSync(statePath, 'utf8')) as OpsAlertsState;
    return {
      alerts: parsed.alerts ?? {},
      history: parsed.history ?? [],
    };
  } catch {
    return { ...defaultState };
  }
};

const writeState = (state: OpsAlertsState) => {
  mkdirSync(dirname(statePath), { recursive: true });
  writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
};

let state = readState();

const pushHistory = (item: AlertHistoryItem) => {
  state.history.unshift(item);
  state.history = state.history.slice(0, 200);
};

const trimMuted = (alertId: string) => {
  const entry = state.alerts[alertId];
  if (!entry?.mutedUntil) return;
  if (new Date(entry.mutedUntil).getTime() > Date.now()) return;
  delete entry.mutedUntil;
  delete entry.mutedBy;
  delete entry.muteReason;
};

export const getAlertState = (alertId: string) => {
  trimMuted(alertId);
  const entry = state.alerts[alertId] ?? {};
  const isMuted = Boolean(entry.mutedUntil && new Date(entry.mutedUntil).getTime() > Date.now());
  return {
    ...entry,
    active: !isMuted,
  };
};

export const ackAlert = (alertId: string, actor: string, reason?: string) => {
  const entry = state.alerts[alertId] ?? {};
  entry.acknowledgedAt = new Date().toISOString();
  entry.acknowledgedBy = actor;
  entry.ackReason = reason?.trim() || undefined;
  state.alerts[alertId] = entry;
  pushHistory({
    id: `h_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    alertId,
    action: 'ack',
    actor,
    reason: entry.ackReason,
    createdAt: entry.acknowledgedAt,
  });
  writeState(state);
  return entry;
};

export const muteAlert = (alertId: string, actor: string, minutes: number, reason?: string) => {
  const entry = state.alerts[alertId] ?? {};
  const mutedUntil = new Date(Date.now() + minutes * 60 * 1000).toISOString();
  entry.mutedUntil = mutedUntil;
  entry.mutedBy = actor;
  entry.muteReason = reason?.trim() || undefined;
  state.alerts[alertId] = entry;
  pushHistory({
    id: `h_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    alertId,
    action: 'mute',
    actor,
    reason: entry.muteReason,
    createdAt: new Date().toISOString(),
    mutedUntil,
  });
  writeState(state);
  return entry;
};

export const unmuteAlert = (alertId: string, actor: string, reason?: string) => {
  const entry = state.alerts[alertId] ?? {};
  delete entry.mutedUntil;
  delete entry.mutedBy;
  delete entry.muteReason;
  state.alerts[alertId] = entry;
  pushHistory({
    id: `h_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    alertId,
    action: 'unmute',
    actor,
    reason: reason?.trim() || undefined,
    createdAt: new Date().toISOString(),
  });
  writeState(state);
  return entry;
};

export const getAlertHistory = (limit = 50) => state.history.slice(0, Math.max(1, limit));

export const getAlertStatePath = () => statePath;
