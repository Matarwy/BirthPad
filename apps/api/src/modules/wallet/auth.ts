import { createHash } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { store } from '../../db/store';
import type { AppRole } from '../../security/roles';
import { resolveRoleForWallet } from '../../security/roles';

const walletSecret = process.env.WALLET_AUTH_SECRET ?? 'dev-wallet-secret';

const hashBody = (value: unknown) => createHash('sha256').update(JSON.stringify(value ?? {})).digest('hex');

const expectedSignature = (walletAddress: string, nonce: string, action: string, bodyHash: string) =>
  createHash('sha256').update(`${walletAddress}:${nonce}:${action}:${bodyHash}:${walletSecret}`).digest('hex');

export const verifyWalletAuth = (action: string) => (req: Request, res: Response, next: NextFunction) => {
  const walletAddress = req.header('x-wallet-address');
  const signature = req.header('x-wallet-signature');
  const nonce = req.header('x-wallet-nonce');

  if (!walletAddress || !signature || !nonce) {
    return res.status(401).json({ error: 'Missing wallet authentication headers' });
  }

  const nonceKey = `${walletAddress}:${nonce}`;
  if (store.consumedNonces.has(nonceKey)) {
    return res.status(409).json({ error: 'Nonce already used' });
  }

  const bodyHash = hashBody(req.body);
  if (expectedSignature(walletAddress, nonce, action, bodyHash) !== signature) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  store.consumedNonces.add(nonceKey);
  const role = resolveRoleForWallet(walletAddress);
  req.wallet = { walletAddress, nonce, role };
  return next();
};

/* eslint-disable @typescript-eslint/no-namespace */
declare global {
  namespace Express {
    interface Request {
      wallet?: {
        walletAddress: string;
        nonce: string;
        role: AppRole;
      };
    }
  }
}

/* eslint-enable @typescript-eslint/no-namespace */
