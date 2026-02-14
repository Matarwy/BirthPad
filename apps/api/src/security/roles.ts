import { store } from '../db/store';

export type AppRole = 'founder' | 'investor' | 'admin';

const roleRank: Record<AppRole, number> = {
  investor: 1,
  founder: 2,
  admin: 3,
};

export const hasRequiredRole = (currentRole: AppRole, minimumRole: AppRole) => roleRank[currentRole] >= roleRank[minimumRole];

export const resolveRoleForWallet = (walletAddress: string): AppRole => {
  const adminWallets = (process.env.ADMIN_WALLETS ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  if (adminWallets.includes(walletAddress)) {
    return 'admin';
  }

  const existingUserId = store.usersByWallet.get(walletAddress);
  if (!existingUserId) {
    return 'founder';
  }

  const existing = store.users.get(existingUserId);
  if (!existing) {
    return 'founder';
  }

  return existing.role;
};
