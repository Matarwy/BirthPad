import { Router } from 'express';

export const transactionsRouter = Router();

transactionsRouter.get('/', (_, res) => {
  res.json([
    { id: 't_1', direction: 'in', hash: '0x123', amount: '1000' },
    { id: 't_2', direction: 'out', hash: '0x456', amount: '250' },
  ]);
});
