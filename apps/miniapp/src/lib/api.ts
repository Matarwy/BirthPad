import type {
  ClaimableStats,
  DeploymentConfigResponse,
  DeploymentDriftResponse,
  OpsAlertsResponse,
  OpsAlertHistoryResponse,
  OpsAnomaliesResponse,
  Project,
  ProjectDetailResponse,
  Sale,
  Tx,
  WalletSession,
} from '../types';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';
const encoder = new TextEncoder();

const asHex = (bytes: ArrayBuffer) =>
  Array.from(new Uint8Array(bytes))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

const sha256 = async (value: string) => {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return asHex(digest);
};

const randomNonce = () => Math.random().toString(36).slice(2, 12);

export const loginWithTelegram = async (telegramInitData: string) => {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ telegramInitData }),
  });

  if (!res.ok) throw new Error('Telegram auth failed');
  return res.json() as Promise<{ token: string; user: { id: string; role: string } }>;
};

const walletHeaders = async (action: string, wallet: WalletSession, body: unknown) => {
  const nonce = randomNonce();
  const bodyHash = await sha256(JSON.stringify(body ?? {}));
  const secret = import.meta.env.VITE_WALLET_AUTH_SECRET ?? 'dev-wallet-secret';
  const signature = await sha256(`${wallet.address}:${nonce}:${action}:${bodyHash}:${secret}`);

  return {
    'x-wallet-address': wallet.address,
    'x-wallet-nonce': nonce,
    'x-wallet-signature': signature,
  };
};

export const getProjects = async (sort: 'all' | 'trending' | 'new' = 'all') => {
  const res = await fetch(`${API_BASE}/projects?sort=${sort}`);
  if (!res.ok) throw new Error('Failed to load launches');
  return res.json() as Promise<Project[]>;
};

export const getProjectDetail = async (projectId: string) => {
  const res = await fetch(`${API_BASE}/projects/${projectId}`);
  if (!res.ok) throw new Error('Failed to load launch detail');
  return res.json() as Promise<ProjectDetailResponse>;
};

export const getSales = async () => {
  const res = await fetch(`${API_BASE}/sales`);
  if (!res.ok) throw new Error('Failed to load sales');
  return res.json() as Promise<Sale[]>;
};

export const createLaunch = async (
  wallet: WalletSession,
  payload: {
    name: string;
    description: string;
    hardCap: string;
    softCap: string;
    tokenSymbol: string;
    tokenPrice: string;
    totalSupply: string;
    startsAt: string;
    endsAt: string;
    teamVesting: {
      enabled: boolean;
      cliffSeconds: number;
      durationSeconds: number;
      unlockStartAt?: string;
    };
    liquidityLock: {
      enabled: boolean;
      lockUntil?: string;
    };
    buyLimits?: {
      minBuyAmount: string;
      maxBuyAmount: string;
    };
    whitelist?: {
      enabled: boolean;
      addresses: string[];
    };
  },
) => {
  const headers = await walletHeaders('create-project', wallet, payload);
  const res = await fetch(`${API_BASE}/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(payload),
  });

  if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to create launch');
  return res.json() as Promise<{ project: Project; sale: Sale }>;
};

export const buyLaunch = async (wallet: WalletSession, projectId: string, amount: string) => {
  const payload = { amount };
  const headers = await walletHeaders('buy-project', wallet, payload);
  const res = await fetch(`${API_BASE}/projects/${projectId}/buy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(payload),
  });

  if (!res.ok) throw new Error((await res.json()).error ?? 'Buy request failed');
  return res.json() as Promise<{ contributionId: string; txHash: string; status: string }>;
};

export const getTransactions = async () => {
  const res = await fetch(`${API_BASE}/transactions`);
  if (!res.ok) throw new Error('Failed to load transactions');
  return res.json() as Promise<Tx[]>;
};

const runLifecycleAction = async (
  wallet: WalletSession,
  projectId: string,
  action: 'pause-project' | 'resume-project' | 'finalize-project' | 'refund-project',
  route: 'pause' | 'resume' | 'finalize' | 'refund',
) => {
  const payload = {};
  const headers = await walletHeaders(action, wallet, payload);
  const res = await fetch(`${API_BASE}/projects/${projectId}/${route}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(payload),
  });

  if (!res.ok) throw new Error((await res.json()).error ?? `${route} request failed`);
  return res.json() as Promise<{ status: string; saleState?: string }>;
};

export const pauseLaunch = async (wallet: WalletSession, projectId: string) =>
  runLifecycleAction(wallet, projectId, 'pause-project', 'pause');

export const resumeLaunch = async (wallet: WalletSession, projectId: string) =>
  runLifecycleAction(wallet, projectId, 'resume-project', 'resume');

export const finalizeLaunch = async (wallet: WalletSession, projectId: string) =>
  runLifecycleAction(wallet, projectId, 'finalize-project', 'finalize');

export const refundLaunch = async (wallet: WalletSession, projectId: string) =>
  runLifecycleAction(wallet, projectId, 'refund-project', 'refund');

export const updateLaunchWhitelist = async (
  wallet: WalletSession,
  projectId: string,
  addresses: string[],
) => {
  const payload = { addresses };
  const headers = await walletHeaders('update-whitelist', wallet, payload);
  const res = await fetch(`${API_BASE}/projects/${projectId}/whitelist`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(payload),
  });

  if (!res.ok) throw new Error((await res.json()).error ?? 'Whitelist update failed');
  return res.json() as Promise<{ whitelistEnabled: boolean; whitelistCount: number }>;
};

export const getClaimableForProject = async (wallet: WalletSession, projectId: string) => {
  const payload = {};
  const headers = await walletHeaders('claimable-project', wallet, payload);
  const res = await fetch(`${API_BASE}/projects/${projectId}/claimable`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json', ...headers },
  });

  if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to load claimable data');
  return res.json() as Promise<ClaimableStats>;
};

export const claimProjectTokens = async (wallet: WalletSession, projectId: string) => {
  const payload = {};
  const headers = await walletHeaders('claim-project', wallet, payload);
  const res = await fetch(`${API_BASE}/projects/${projectId}/claim`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(payload),
  });

  if (!res.ok) throw new Error((await res.json()).error ?? 'Claim failed');
  return res.json() as Promise<{ projectId: string; txHash: string; claimedAmount: string }>;
};

export const getDeploymentConfig = async () => {
  const res = await fetch(`${API_BASE}/config/deployment`);
  if (!res.ok) throw new Error('Failed to load deployment config');
  return res.json() as Promise<DeploymentConfigResponse>;
};

export const getDeploymentDrift = async () => {
  const res = await fetch(`${API_BASE}/config/drift`);
  if (!res.ok) throw new Error('Failed to load deployment drift');
  return res.json() as Promise<DeploymentDriftResponse>;
};

export const getOpsAlerts = async () => {
  const res = await fetch(`${API_BASE}/config/alerts`);
  if (!res.ok) throw new Error('Failed to load ops alerts');
  return res.json() as Promise<OpsAlertsResponse>;
};

export const acknowledgeOpsAlert = async (
  wallet: WalletSession,
  alertId: string,
  reason?: string,
) => {
  const payload = { reason };
  const headers = await walletHeaders('ack-alert', wallet, payload);
  const res = await fetch(`${API_BASE}/config/alerts/${alertId}/ack`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to acknowledge alert');
  return res.json() as Promise<{ alertId: string; status: string; acknowledgedAt: string }>;
};

export const muteOpsAlert = async (
  wallet: WalletSession,
  alertId: string,
  minutes: number,
  reason?: string,
) => {
  const payload = { minutes, reason };
  const headers = await walletHeaders('mute-alert', wallet, payload);
  const res = await fetch(`${API_BASE}/config/alerts/${alertId}/mute`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to mute alert');
  return res.json() as Promise<{ alertId: string; status: string; mutedUntil: string }>;
};

export const unmuteOpsAlert = async (wallet: WalletSession, alertId: string) => {
  const payload = {};
  const headers = await walletHeaders('unmute-alert', wallet, payload);
  const res = await fetch(`${API_BASE}/config/alerts/${alertId}/unmute`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to unmute alert');
  return res.json() as Promise<{ alertId: string; status: string }>;
};

export const getOpsAnomalies = async () => {
  const res = await fetch(`${API_BASE}/config/anomalies`);
  if (!res.ok) throw new Error('Failed to load anomaly data');
  return res.json() as Promise<OpsAnomaliesResponse>;
};

export const getOpsAlertHistory = async (limit = 50) => {
  const res = await fetch(`${API_BASE}/config/alerts/history?limit=${limit}`);
  if (!res.ok) throw new Error('Failed to load alert history');
  return res.json() as Promise<OpsAlertHistoryResponse>;
};
