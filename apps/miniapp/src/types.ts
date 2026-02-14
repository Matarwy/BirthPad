export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
}

export interface Project {
  id: string;
  ownerId: string;
  name: string;
  description: string;
  status: 'draft' | 'active' | 'finalized' | 'refunded';
  hardCap: string;
  softCap: string;
  createdAt: string;
  updatedAt: string;
  raisedAmount?: string;
}

export interface Sale {
  id: string;
  projectId: string;
  tokenSymbol: string;
  tokenPrice: string;
  totalSupply: string;
  raisedAmount: string;
  state: 'upcoming' | 'active' | 'finalized' | 'refunded';
  startsAt: string;
  endsAt: string;
  finalizedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectDetailResponse {
  project: Project;
  sale?: Sale;
  progress?: {
    raised: string;
    hardCap: string;
    progress: number;
  };
}

export interface WalletSession {
  address: string;
  connectedAt: string;
  provider: 'tonconnect';
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
