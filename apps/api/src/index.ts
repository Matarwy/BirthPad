import { app } from './app';
import { startTonIndexerWorker } from './modules/indexer/worker';

const port = Number(process.env.PORT ?? 3000);
startTonIndexerWorker();
app.listen(port, () => {
  console.log(`API listening on :${port}`);
});
