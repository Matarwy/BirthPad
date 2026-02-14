import { describe, expect, it } from 'vitest';

enum SaleState {
  Draft,
  Live,
  Successful,
  Failed,
  Finalized,
}

class ProjectSaleModel {
  public state = SaleState.Draft;
  public totalRaised = 0n;
  public readonly contributions = new Map<string, bigint>();

  constructor(
    private readonly owner: string,
    private readonly softCap: bigint,
    private readonly hardCap: bigint,
    private readonly minContribution: bigint,
    private readonly maxContribution: bigint,
    private readonly liquidityBps: bigint,
    private readonly treasuryBps: bigint,
  ) {}

  start(caller: string) {
    if (caller !== this.owner) throw new Error('unauthorized');
    if (this.state !== SaleState.Draft) throw new Error('state');
    this.state = SaleState.Live;
  }

  buy(caller: string, amount: bigint) {
    if (this.state !== SaleState.Live) throw new Error('not live');
    if (amount < this.minContribution) throw new Error('below min');

    const existing = this.contributions.get(caller) ?? 0n;
    const next = existing + amount;

    if (next > this.maxContribution) throw new Error('above max');
    if (this.totalRaised + amount > this.hardCap) throw new Error('hard cap exceeded');

    this.contributions.set(caller, next);
    this.totalRaised += amount;

    if (this.totalRaised >= this.hardCap) {
      this.state = SaleState.Successful;
    }
  }

  finalize(caller: string) {
    if (caller !== this.owner) throw new Error('unauthorized');
    if (this.state === SaleState.Finalized) throw new Error('already finalized');

    if (this.state === SaleState.Live) {
      this.state = this.totalRaised >= this.softCap ? SaleState.Successful : SaleState.Failed;
    }

    if (this.state !== SaleState.Successful) throw new Error('not successful');

    const liquidity = (this.totalRaised * this.liquidityBps) / 10_000n;
    const treasury = (this.totalRaised * this.treasuryBps) / 10_000n;
    this.state = SaleState.Finalized;

    return { liquidity, treasury };
  }

  refund(caller: string) {
    if (this.state !== SaleState.Failed) throw new Error('not failed');
    const amount = this.contributions.get(caller) ?? 0n;
    if (amount <= 0n) throw new Error('no contribution');
    this.contributions.set(caller, 0n);
    return amount;
  }
}

describe('ProjectSale boundary behavior', () => {
  it('rejects cap overflow', () => {
    const sale = new ProjectSaleModel('owner', 50n, 100n, 10n, 90n, 6000n, 3000n);
    sale.start('owner');
    sale.buy('alice', 80n);
    expect(() => sale.buy('bob', 21n)).toThrow(/hard cap exceeded/);
  });

  it('prevents double finalize', () => {
    const sale = new ProjectSaleModel('owner', 40n, 100n, 10n, 100n, 5000n, 4000n);
    sale.start('owner');
    sale.buy('alice', 40n);

    const allocation = sale.finalize('owner');
    expect(allocation).toEqual({ liquidity: 20n, treasury: 16n });
    expect(() => sale.finalize('owner')).toThrow(/already finalized/);
  });

  it('blocks unauthorized actions', () => {
    const sale = new ProjectSaleModel('owner', 50n, 100n, 10n, 100n, 5000n, 4000n);
    expect(() => sale.start('attacker')).toThrow(/unauthorized/);

    sale.start('owner');
    sale.buy('alice', 10n);
    expect(() => sale.finalize('attacker')).toThrow(/unauthorized/);
  });

  it('supports refunds when sale fails', () => {
    const sale = new ProjectSaleModel('owner', 60n, 100n, 10n, 100n, 5000n, 4000n);
    sale.start('owner');
    sale.buy('alice', 20n);

    expect(() => sale.finalize('owner')).toThrow(/not successful/);
    sale.state = SaleState.Failed;

    expect(sale.refund('alice')).toBe(20n);
    expect(() => sale.refund('alice')).toThrow(/no contribution/);
  });
});
