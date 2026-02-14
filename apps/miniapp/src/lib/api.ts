import type { Project, ProjectDetailResponse, Sale, Tx, WalletSession } from '../types';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';
const encoder = new TextEncoder();

const asHex = (bytes: ArrayBuffer) => Array.from(new Uint8Array(bytes)).map((b) => b.toString(16).padStart(2, '0')).join('');

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
