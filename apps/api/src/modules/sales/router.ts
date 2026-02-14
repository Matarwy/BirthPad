import { Router } from 'express';

export const salesRouter = Router();

salesRouter.get('/', (_, res) => {
  res.json([
    { id: 's_1', projectId: 'p_1', amount: '1500.00', currency: 'USDT' },
    { id: 's_2', projectId: 'p_2', amount: '750.00', currency: 'TON' },
  ]);
});
