import { Router } from 'express';

export const projectsRouter = Router();

projectsRouter.get('/', (_, res) => {
  res.json([
    { id: 'p_1', name: 'BirthPad Genesis', status: 'active' },
    { id: 'p_2', name: 'BirthPad Labs', status: 'draft' },
  ]);
});
