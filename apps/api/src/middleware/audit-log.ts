import { appendFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { NextFunction, Request, Response } from 'express';

const auditDir = process.env.AUDIT_LOG_DIR ?? 'audit';
const auditFile = join(auditDir, 'critical-actions.log');

const ensureAuditDir = () => {
  if (!existsSync(auditDir)) {
    mkdirSync(auditDir, { recursive: true });
  }
};

interface AuditEntry {
  action: string;
  method: string;
  path: string;
  statusCode: number;
  walletAddress?: string;
  projectId?: string;
  timestamp: string;
}

const persistAuditEntry = (entry: AuditEntry) => {
  ensureAuditDir();
  appendFileSync(auditFile, `${JSON.stringify(entry)}\n`);
};

export const auditCriticalAction = (action: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    res.on('finish', () => {
      persistAuditEntry({
        action,
        method: req.method,
        path: req.originalUrl,
        statusCode: res.statusCode,
        walletAddress: req.wallet?.walletAddress,
        projectId: typeof req.params.id === 'string' ? req.params.id : undefined,
        timestamp: new Date().toISOString(),
      });
    });

    next();
  };
};
