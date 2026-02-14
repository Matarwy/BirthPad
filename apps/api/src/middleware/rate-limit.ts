import type { NextFunction, Request, Response } from 'express';

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

const now = () => Date.now();

const keyForRequest = (req: Request) => req.header('x-wallet-address') ?? req.ip ?? 'anonymous';

export const createRateLimiter = (name: string, maxRequests: number, windowMs: number) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = `${name}:${keyForRequest(req)}`;
    const current = buckets.get(key);
    const currentTs = now();

    if (!current || current.resetAt <= currentTs) {
      buckets.set(key, { count: 1, resetAt: currentTs + windowMs });
      return next();
    }

    if (current.count >= maxRequests) {
      const retryAfterSec = Math.ceil((current.resetAt - currentTs) / 1000);
      res.setHeader('retry-after', String(Math.max(1, retryAfterSec)));
      return res.status(429).json({ error: 'Rate limit exceeded', retryAfterSec });
    }

    current.count += 1;
    buckets.set(key, current);
    return next();
  };
};
