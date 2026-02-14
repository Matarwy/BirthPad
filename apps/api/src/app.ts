import cors from 'cors';
import express from 'express';
import { authRouter } from './modules/auth/router';
import { configRouter } from './modules/config/router';
import { openapiRouter } from './modules/openapi/router';
import { projectsRouter } from './modules/projects/router';
import { salesRouter } from './modules/sales/router';
import { transactionsRouter } from './modules/transactions/router';

export const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (_, res) => {
  res.json({ status: 'ok' });
});

app.use('/auth', authRouter);
app.use('/config', configRouter);
app.use('/projects', projectsRouter);
app.use('/sales', salesRouter);
app.use('/transactions', transactionsRouter);
app.use('/openapi', openapiRouter);
