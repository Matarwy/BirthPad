import type { NextFunction, Request, Response } from 'express';
import type { AppRole } from '../security/roles';
import { hasRequiredRole } from '../security/roles';

export const requireRole = (requiredRole: AppRole) => (req: Request, res: Response, next: NextFunction) => {
  const role = req.wallet?.role;
  if (!role || !hasRequiredRole(role, requiredRole)) {
    return res.status(403).json({ error: `Requires ${requiredRole} role` });
  }
  return next();
};
