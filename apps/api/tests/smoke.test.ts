import { createHash } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { app } from '../src/app';
import { startTonIndexerWorker } from '../src/modules/indexer/worker';

let baseUrl = '';
let server: ReturnType<typeof app.listen>;

const sign = (wallet: string, nonce: string, action: string, body: unknown) => {
  const bodyHash = createHash('sha256').update(JSON.stringify(body)).digest('hex');
  return createHash('sha256')
    .update(`${wallet}:${nonce}:${action}:${bodyHash}:dev-wallet-secret`)
    .digest('hex');
};

describe('api', () => {
  beforeAll(async () => {
    startTonIndexerWorker();
    server = app.listen(0);
    await new Promise<void>((resolve) => server.once('listening', () => resolve()));
    const address = server.address();
    if (typeof address === 'string' || !address) throw new Error('invalid address');
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  });

  it('creates project and handles buy/finalize/refund flow', async () => {
    const createPayload = {
      name: 'Genesis',
      description: 'Launch project',
      hardCap: '1000',
      softCap: '100',
      tokenSymbol: 'BIRTH',
      tokenPrice: '1',
      totalSupply: '1000000',
      startsAt: new Date().toISOString(),
      endsAt: new Date(Date.now() + 3_600_000).toISOString(),
    };

    const wallet = 'EQ_test_wallet';
    const createResp = await fetch(`${baseUrl}/projects`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-wallet-address': wallet,
        'x-wallet-nonce': '1',
        'x-wallet-signature': sign(wallet, '1', 'create-project', createPayload),
      },
      body: JSON.stringify(createPayload),
    });
    expect(createResp.status).toBe(201);
    const created = await createResp.json();

    const buyPayload = { amount: '250' };
    const buyResp = await fetch(`${baseUrl}/projects/${created.project.id}/buy`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-wallet-address': 'EQ_investor',
        'x-wallet-nonce': '2',
        'x-wallet-signature': sign('EQ_investor', '2', 'buy-project', buyPayload),
      },
      body: JSON.stringify(buyPayload),
    });
    expect(buyResp.status).toBe(202);

    const detailResp = await fetch(`${baseUrl}/projects/${created.project.id}`);
    expect(detailResp.status).toBe(200);
    const detail = await detailResp.json();
    expect(Number(detail.progress.raised)).toBeGreaterThanOrEqual(250);

    const finalizeResp = await fetch(`${baseUrl}/projects/${created.project.id}/finalize`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-wallet-address': wallet,
        'x-wallet-nonce': '3',
        'x-wallet-signature': sign(wallet, '3', 'finalize-project', {}),
      },
      body: JSON.stringify({}),
    });
    expect(finalizeResp.status).toBe(200);

    const refundResp = await fetch(`${baseUrl}/projects/${created.project.id}/refund`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-wallet-address': wallet,
        'x-wallet-nonce': '4',
        'x-wallet-signature': sign(wallet, '4', 'refund-project', {}),
      },
      body: JSON.stringify({}),
    });
    expect(refundResp.status).toBe(200);
  });
});
