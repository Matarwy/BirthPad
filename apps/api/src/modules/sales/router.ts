import { Router } from 'express';
import { store } from '../../db/store';

export const salesRouter = Router();

salesRouter.get('/', (_, res) => {
  res.json([...store.sales.values()]);
});
