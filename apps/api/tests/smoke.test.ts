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
    process.env.ADMIN_WALLETS = 'EQ_admin_wallet';
    startTonIndexerWorker();
    server = app.listen(0);
    await new Promise<void>((resolve) => server.once('listening', () => resolve()));
    const address = server.address();
    if (typeof address === 'string' || !address) throw new Error('invalid address');
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve())),
    );
  });

  it('creates project and handles buy/finalize/refund flow', async () => {
    const configResp = await fetch(`${baseUrl}/config/deployment`);
    expect(configResp.status).toBe(200);
    const configPayload = await configResp.json();
    expect(configPayload.deploymentEnv).toBe('devnet');
    expect(typeof configPayload.contracts.launchFactory).toBe('string');
    expect(configPayload.health).toBeDefined();

    const driftResp = await fetch(`${baseUrl}/config/drift`);
    expect(driftResp.status).toBe(200);
    const driftPayload = await driftResp.json();
    expect(typeof driftPayload.mismatchCount).toBe('number');
    expect(Array.isArray(driftPayload.checks)).toBe(true);

    const alertsResp = await fetch(`${baseUrl}/config/alerts`);
    expect(alertsResp.status).toBe(200);
    const alertsPayload = await alertsResp.json();
    expect(Array.isArray(alertsPayload.alerts)).toBe(true);
    expect(Array.isArray(alertsPayload.incidents)).toBe(true);
    expect(typeof alertsPayload.statePath).toBe('string');

    const historyResp = await fetch(`${baseUrl}/config/alerts/history?limit=5`);
    expect(historyResp.status).toBe(200);
    const historyPayload = await historyResp.json();
    expect(Array.isArray(historyPayload.items)).toBe(true);
    if (alertsPayload.alerts.length > 0) {
      const alertId = alertsPayload.alerts[0].id;
      const ackResp = await fetch(`${baseUrl}/config/alerts/${alertId}/ack`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-wallet-address': 'EQ_admin_wallet',
          'x-wallet-nonce': 'ack-alert-1',
          'x-wallet-signature': sign('EQ_admin_wallet', 'ack-alert-1', 'ack-alert', {
            reason: 'ack in smoke test',
          }),
        },
        body: JSON.stringify({ reason: 'ack in smoke test' }),
      });
      expect(ackResp.status).toBe(200);

      const muteResp = await fetch(`${baseUrl}/config/alerts/${alertId}/mute`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-wallet-address': 'EQ_admin_wallet',
          'x-wallet-nonce': 'mute-alert-1',
          'x-wallet-signature': sign('EQ_admin_wallet', 'mute-alert-1', 'mute-alert', {
            minutes: 5,
            reason: 'mute in smoke test',
          }),
        },
        body: JSON.stringify({ minutes: 5, reason: 'mute in smoke test' }),
      });
      expect(muteResp.status).toBe(200);

      const unmuteResp = await fetch(`${baseUrl}/config/alerts/${alertId}/unmute`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-wallet-address': 'EQ_admin_wallet',
          'x-wallet-nonce': 'unmute-alert-1',
          'x-wallet-signature': sign('EQ_admin_wallet', 'unmute-alert-1', 'unmute-alert', {}),
        },
        body: JSON.stringify({}),
      });
      expect(unmuteResp.status).toBe(200);
    }

    const anomaliesResp = await fetch(`${baseUrl}/config/anomalies`);
    expect(anomaliesResp.status).toBe(200);
    const anomaliesPayload = await anomaliesResp.json();
    expect(typeof anomaliesPayload.windowHours).toBe('number');
    expect(Array.isArray(anomaliesPayload.buckets)).toBe(true);
    expect(Array.isArray(anomaliesPayload.anomalies)).toBe(true);
    expect(anomaliesPayload.thresholds).toBeDefined();

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
      teamVesting: {
        enabled: true,
        cliffSeconds: 0,
        durationSeconds: 1,
        unlockStartAt: new Date(Date.now() - 5_000).toISOString(),
      },
      liquidityLock: {
        enabled: true,
        lockUntil: new Date(Date.now() + 86_400_000).toISOString(),
      },
      whitelist: {
        enabled: true,
        addresses: ['EQ_investor'],
      },
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
    const forbiddenBuyResp = await fetch(`${baseUrl}/projects/${created.project.id}/buy`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-wallet-address': 'EQ_not_allowed',
        'x-wallet-nonce': 'blocked-buy',
        'x-wallet-signature': sign('EQ_not_allowed', 'blocked-buy', 'buy-project', buyPayload),
      },
      body: JSON.stringify(buyPayload),
    });
    expect(forbiddenBuyResp.status).toBe(403);

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
    expect(detail.sale.teamVesting.enabled).toBe(true);
    expect(detail.sale.liquidityLock.enabled).toBe(true);
    expect(detail.sale.whitelistAddresses).toContain('EQ_investor');
    expect(detail.risk).toBeDefined();
    expect(typeof detail.risk.score).toBe('number');

    const whitelistUpdateResp = await fetch(`${baseUrl}/projects/${created.project.id}/whitelist`, {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        'x-wallet-address': wallet,
        'x-wallet-nonce': 'whitelist-owner',
        'x-wallet-signature': sign(wallet, 'whitelist-owner', 'update-whitelist', {
          addresses: ['EQ_investor', 'EQ_test_wallet'],
        }),
      },
      body: JSON.stringify({ addresses: ['EQ_investor', 'EQ_test_wallet'] }),
    });
    expect(whitelistUpdateResp.status).toBe(200);

    const riskResp = await fetch(`${baseUrl}/projects/${created.project.id}/risk`);
    expect(riskResp.status).toBe(200);

    const pauseResp = await fetch(`${baseUrl}/projects/${created.project.id}/pause`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-wallet-address': wallet,
        'x-wallet-nonce': 'pause-owner',
        'x-wallet-signature': sign(wallet, 'pause-owner', 'pause-project', {}),
      },
      body: JSON.stringify({}),
    });
    expect(pauseResp.status).toBe(200);

    const buyWhilePaused = await fetch(`${baseUrl}/projects/${created.project.id}/buy`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-wallet-address': 'EQ_investor',
        'x-wallet-nonce': 'buy-paused',
        'x-wallet-signature': sign('EQ_investor', 'buy-paused', 'buy-project', buyPayload),
      },
      body: JSON.stringify(buyPayload),
    });
    expect(buyWhilePaused.status).toBe(409);

    const resumeResp = await fetch(`${baseUrl}/projects/${created.project.id}/resume`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-wallet-address': wallet,
        'x-wallet-nonce': 'resume-owner',
        'x-wallet-signature': sign(wallet, 'resume-owner', 'resume-project', {}),
      },
      body: JSON.stringify({}),
    });
    expect(resumeResp.status).toBe(200);

    const forbiddenFinalize = await fetch(`${baseUrl}/projects/${created.project.id}/finalize`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-wallet-address': wallet,
        'x-wallet-nonce': 'forbidden-finalize',
        'x-wallet-signature': sign(wallet, 'forbidden-finalize', 'finalize-project', {}),
      },
      body: JSON.stringify({}),
    });
    expect(forbiddenFinalize.status).toBe(409);

    const finalizeResp = await fetch(`${baseUrl}/projects/${created.project.id}/finalize`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-wallet-address': 'EQ_admin_wallet',
        'x-wallet-nonce': '3',
        'x-wallet-signature': sign('EQ_admin_wallet', '3', 'finalize-project', {}),
      },
      body: JSON.stringify({}),
    });
    expect(finalizeResp.status).toBe(200);

    await new Promise((resolve) => setTimeout(resolve, 300));

    const claimableResp = await fetch(`${baseUrl}/projects/${created.project.id}/claimable`, {
      method: 'GET',
      headers: {
        'content-type': 'application/json',
        'x-wallet-address': 'EQ_investor',
        'x-wallet-nonce': 'claimable-1',
        'x-wallet-signature': sign('EQ_investor', 'claimable-1', 'claimable-project', {}),
      },
    });
    expect(claimableResp.status).toBe(200);
    const claimablePayload = await claimableResp.json();
    expect(Number(claimablePayload.claimableAmount)).toBeGreaterThan(0);

    const claimResp = await fetch(`${baseUrl}/projects/${created.project.id}/claim`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-wallet-address': 'EQ_investor',
        'x-wallet-nonce': 'claim-1',
        'x-wallet-signature': sign('EQ_investor', 'claim-1', 'claim-project', {}),
      },
      body: JSON.stringify({}),
    });
    expect(claimResp.status).toBe(200);

    const refundResp = await fetch(`${baseUrl}/projects/${created.project.id}/refund`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-wallet-address': 'EQ_admin_wallet',
        'x-wallet-nonce': '4',
        'x-wallet-signature': sign('EQ_admin_wallet', '4', 'refund-project', {}),
      },
      body: JSON.stringify({}),
    });
    expect(refundResp.status).toBe(409);
  });
});
