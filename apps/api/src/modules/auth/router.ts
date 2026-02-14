import { Router } from 'express';
import { z } from 'zod';
import { deploymentConfig, deploymentEnv } from '../../config/environments';

const loginSchema = z.object({
  telegramInitData: z.string().min(1),
});

export const authRouter = Router();

authRouter.post('/login', (req, res) => {
  const payload = loginSchema.safeParse(req.body);
  if (!payload.success) {
    return res.status(400).json({ error: payload.error.flatten() });
  }

  return res.json({
    token: 'dev-token',
    user: { id: 'tg-user', role: 'founder' },
    deploymentEnv,
    contracts: deploymentConfig.contracts,
  });
});
