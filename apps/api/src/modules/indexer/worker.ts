import { EventEmitter } from 'node:events';
import { createTx, store } from '../../db/store';

type TonEventType = 'ContributionConfirmed' | 'SaleFinalized' | 'ContributionRefunded';

export interface TonEvent {
  type: TonEventType;
  projectId: string;
  txHash: string;
  contributionId?: string;
  userId?: string;
  amount: string;
}

const indexerBus = new EventEmitter();
let started = false;

const asNum = (value: string) => Number(value);

export const processTonEvent = (event: TonEvent): void => {
  const saleId = store.salesByProject.get(event.projectId);
  const sale = saleId ? store.sales.get(saleId) : undefined;

  if (event.type === 'ContributionConfirmed' && event.contributionId) {
    const contribution = store.contributions.get(event.contributionId);
    if (contribution) {
      contribution.status = 'confirmed';
      contribution.txHash = event.txHash;
      contribution.updatedAt = new Date().toISOString();
    }
    if (sale) {
      sale.raisedAmount = `${asNum(sale.raisedAmount) + asNum(event.amount)}`;
      sale.updatedAt = new Date().toISOString();
    }
  }

  if (event.type === 'SaleFinalized') {
    if (sale) {
      sale.state = 'finalized';
      sale.finalizedAt = new Date().toISOString();
      sale.updatedAt = sale.finalizedAt;
    }
    const project = store.projects.get(event.projectId);
    if (project) {
      project.status = 'finalized';
      project.updatedAt = new Date().toISOString();
    }
  }

  if (event.type === 'ContributionRefunded' && event.contributionId) {
    const contribution = store.contributions.get(event.contributionId);
    if (contribution) {
      contribution.status = 'refunded';
      contribution.txHash = event.txHash;
      contribution.updatedAt = new Date().toISOString();
    }

    if (sale) {
      sale.state = 'refunded';
      sale.updatedAt = new Date().toISOString();
    }
  }

  createTx({
    projectId: event.projectId,
    contributionId: event.contributionId,
    userId: event.userId,
    txHash: event.txHash,
    direction: event.type === 'ContributionRefunded' ? 'out' : 'in',
    eventType: event.type,
    amount: event.amount,
    status: event.type === 'ContributionRefunded' ? 'refunded' : 'confirmed',
    metadata: {},
  });
};

export const enqueueTonEvent = (event: TonEvent): void => {
  indexerBus.emit('event', event);
};

export const startTonIndexerWorker = (): void => {
  if (started) return;
  started = true;
  indexerBus.on('event', processTonEvent);
};
