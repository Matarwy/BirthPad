import type { WalletSession } from '../types';

const STORAGE_KEY = 'birthpad.wallet.session';

export const connector = {
  restoreConnection: async () => undefined,
  onStatusChange: (cb: (wallet: { account: { address: string } } | null) => void) => {
    const current = loadWalletSession();
    if (current) cb({ account: { address: current.address } });
    return () => undefined;
  },
};

export const loadWalletSession = (): WalletSession | null => {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as WalletSession;
  } catch {
    return null;
  }
};

export const saveWalletSession = (wallet: WalletSession | null) => {
  if (!wallet) {
    localStorage.removeItem(STORAGE_KEY);
    return;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(wallet));
};

const makePseudoAddress = () => `UQ${crypto.randomUUID().replaceAll('-', '').slice(0, 46)}`;

export const connectWallet = async () => {
  const address = makePseudoAddress();
  saveWalletSession({
    address,
    connectedAt: new Date().toISOString(),
    provider: 'tonconnect',
  });
  return `https://app.tonkeeper.com/transfer/${address}`;
};

export const disconnectWallet = async () => {
  saveWalletSession(null);
};
