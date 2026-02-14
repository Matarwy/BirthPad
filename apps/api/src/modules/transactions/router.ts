import { Router } from 'express';
import { store } from '../../db/store';

export const transactionsRouter = Router();

transactionsRouter.get('/', (_, res) => {
  res.json([...store.transactions.values()]);
});
