import cors from 'cors';
import express from 'express';
import { authRouter } from './modules/auth/router';
import { projectsRouter } from './modules/projects/router';
import { salesRouter } from './modules/sales/router';
import { transactionsRouter } from './modules/transactions/router';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (_, res) => {
  res.json({ status: 'ok' });
});

app.use('/auth', authRouter);
app.use('/projects', projectsRouter);
app.use('/sales', salesRouter);
app.use('/transactions', transactionsRouter);

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => {
  console.log(`API listening on :${port}`);
});
