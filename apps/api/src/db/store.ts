import { randomUUID } from 'node:crypto';

export type ProjectStatus = 'draft' | 'active' | 'finalized' | 'refunded';
export type SaleState = 'upcoming' | 'active' | 'paused' | 'finalized' | 'refunded';

export interface User {
  id: string;
  walletAddress: string;
  role: 'founder' | 'investor' | 'admin';
  createdAt: string;
  updatedAt: string;
}

export interface TeamVesting {
  enabled: boolean;
  cliffSeconds: number;
  durationSeconds: number;
  unlockStartAt?: string;
}

export interface LiquidityLock {
  enabled: boolean;
  lockUntil?: string;
}

export interface Project {
  id: string;
  ownerId: string;
  name: string;
  description: string;
  status: ProjectStatus;
  hardCap: string;
  softCap: string;
  createdAt: string;
  updatedAt: string;
}

export interface Sale {
  id: string;
  projectId: string;
  tokenSymbol: string;
  tokenPrice: string;
  totalSupply: string;
  raisedAmount: string;
  state: SaleState;
  startsAt: string;
  endsAt: string;
  finalizedAt?: string;
  teamVesting: TeamVesting;
  liquidityLock: LiquidityLock;
  minBuyAmount: string;
  maxBuyAmount: string;
  whitelistAddresses: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Contribution {
  id: string;
  projectId: string;
  saleId: string;
  userId: string;
  amount: string;
  claimedAmount: string;
  status: 'pending' | 'confirmed' | 'refunded';
  txHash?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Tx {
  id: string;
  projectId: string;
  contributionId?: string;
  userId?: string;
  txHash: string;
  direction: 'in' | 'out';
  eventType: string;
  amount: string;
  status: 'pending' | 'confirmed' | 'refunded';
  metadata: Record<string, string>;
  createdAt: string;
}

const nowIso = () => new Date().toISOString();

class Store {
  users = new Map<string, User>();
  usersByWallet = new Map<string, string>();
  projects = new Map<string, Project>();
  sales = new Map<string, Sale>();
  salesByProject = new Map<string, string>();
  contributions = new Map<string, Contribution>();
  contributionsByProject = new Map<string, string[]>();
  transactions = new Map<string, Tx>();
  consumedNonces = new Set<string>();

  getOrCreateUser(walletAddress: string, role: User['role'] = 'investor'): User {
    const existingId = this.usersByWallet.get(walletAddress);
    if (existingId) {
      const existing = this.users.get(existingId)!;
      if (role === 'admin' && existing.role !== 'admin') {
        existing.role = 'admin';
        existing.updatedAt = nowIso();
      }
      return existing;
    }

    const ts = nowIso();
    const user: User = {
      id: `u_${randomUUID()}`,
      walletAddress,
      role,
      createdAt: ts,
      updatedAt: ts,
    };
    this.users.set(user.id, user);
    this.usersByWallet.set(walletAddress, user.id);
    return user;
  }

  createProject(input: Omit<Project, 'id' | 'status' | 'createdAt' | 'updatedAt'>): Project {
    const ts = nowIso();
    const project: Project = {
      id: `p_${randomUUID()}`,
      status: 'active',
      createdAt: ts,
      updatedAt: ts,
      ...input,
    };
    this.projects.set(project.id, project);
    return project;
  }

  createSale(input: Omit<Sale, 'id' | 'state' | 'raisedAmount' | 'createdAt' | 'updatedAt'>): Sale {
    const ts = nowIso();
    const sale: Sale = {
      id: `s_${randomUUID()}`,
      state: 'active',
      raisedAmount: '0',
      createdAt: ts,
      updatedAt: ts,
      ...input,
    };
    this.sales.set(sale.id, sale);
    this.salesByProject.set(sale.projectId, sale.id);
    return sale;
  }
}

export const store = new Store();

export const createContribution = (
  input: Omit<Contribution, 'id' | 'createdAt' | 'updatedAt' | 'claimedAmount'>,
) => {
  const ts = nowIso();
  const contribution: Contribution = {
    id: `c_${randomUUID()}`,
    createdAt: ts,
    updatedAt: ts,
    claimedAmount: '0',
    ...input,
  };
  store.contributions.set(contribution.id, contribution);
  const ids = store.contributionsByProject.get(contribution.projectId) ?? [];
  ids.push(contribution.id);
  store.contributionsByProject.set(contribution.projectId, ids);
  return contribution;
};

export const createTx = (input: Omit<Tx, 'id' | 'createdAt'>) => {
  const tx: Tx = {
    id: `t_${randomUUID()}`,
    createdAt: nowIso(),
    ...input,
  };
  store.transactions.set(tx.id, tx);
  return tx;
};
