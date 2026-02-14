export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
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
  state: 'upcoming' | 'active' | 'paused' | 'finalized' | 'refunded';
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

export interface ProjectDetailResponse {
  project: Project;
  sale?: Sale;
  progress?: {
    raised: string;
    hardCap: string;
    progress: number;
  };
  risk?: {
    score: number;
    flags: string[];
    topWalletShare: number;
    uniqueContributors: number;
    whitelistSize: number;
    contributorsTotalAmount: string;
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

export interface ClaimableStats {
  projectId: string;
  saleState: Sale['state'];
  purchasedAmount: string;
  claimedAmount: string;
  unlockedAmount: string;
  claimableAmount: string;
}

export interface DeploymentConfigResponse {
  deploymentEnv: 'devnet' | 'testnet' | 'mainnet';
  env: 'devnet' | 'testnet' | 'mainnet';
  tonNetwork: string;
  apiBaseUrl: string;
  contracts: {
    launchFactory: string;
    projectSaleTemplate: string;
    deployedAt: string;
  };
  health: {
    hasLaunchFactory: boolean;
    hasProjectSaleTemplate: boolean;
    driftDetected: boolean;
  };
}

export interface DeploymentDriftResponse {
  deploymentEnv: 'devnet' | 'testnet' | 'mainnet';
  hasRegistry: boolean;
  mismatchCount: number;
  severity: 'ok' | 'warning' | 'critical';
  checks: Array<{
    field: 'launchFactory' | 'projectSaleTemplate';
    envValue: string;
    registryValue: string;
    matches: boolean;
  }>;
}

export interface OpsAlertsResponse {
  deploymentEnv: 'devnet' | 'testnet' | 'mainnet';
  severity: 'ok' | 'warning' | 'critical';
  alerts: Array<{
    id: string;
    severity: 'info' | 'warning' | 'critical';
    title: string;
    message: string;
    createdAt: string;
    source: 'deployment' | 'sales' | 'transactions';
    acknowledgedAt: string | null;
    acknowledgedBy: string | null;
    ackReason: string | null;
    mutedUntil: string | null;
    mutedBy: string | null;
    muteReason: string | null;
    active: boolean;
  }>;
  incidents: Array<{
    id: string;
    type: string;
    severity: 'info' | 'warning' | 'critical';
    message: string;
    createdAt: string;
    txHash: string;
  }>;
  statePath: string;
}

export interface OpsAlertHistoryResponse {
  deploymentEnv: 'devnet' | 'testnet' | 'mainnet';
  items: Array<{
    id: string;
    alertId: string;
    action: 'ack' | 'mute' | 'unmute';
    actor: string;
    reason?: string;
    createdAt: string;
    mutedUntil?: string;
  }>;
}

export interface OpsAnomaliesResponse {
  deploymentEnv: 'devnet' | 'testnet' | 'mainnet';
  windowHours: number;
  totals: {
    buy: number;
    claim: number;
    refund: number;
    finalize: number;
  };
  buckets: Array<{
    label: string;
    buy: number;
    claim: number;
    refund: number;
    finalize: number;
  }>;
  thresholds: {
    bucketHours: number;
    refundWarningCount: number;
    refundCriticalCount: number;
    buyDropoffLookbackHours: number;
  };
  anomalies: Array<{
    id: string;
    severity: 'warning' | 'critical';
    title: string;
    metric: string;
    details: string;
  }>;
}
