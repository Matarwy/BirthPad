import type { Project, Sale } from '../types';

interface SaleMetricsProps {
  project: Project;
  sale?: Sale;
}

const formatLockDate = (iso?: string) => (iso ? new Date(iso).toLocaleString() : 'N/A');

export const SaleMetrics = ({ project, sale }: SaleMetricsProps) => (
  <div className="metrics-grid">
    <div>
      <strong>Hard cap</strong>
      <p>{project.hardCap} TON</p>
    </div>
    <div>
      <strong>Soft cap</strong>
      <p>{project.softCap} TON</p>
    </div>
    <div>
      <strong>Raised</strong>
      <p>{sale?.raisedAmount ?? project.raisedAmount ?? '0'} TON</p>
    </div>
    <div>
      <strong>Token</strong>
      <p>{sale?.tokenSymbol ?? 'N/A'}</p>
    </div>
    <div>
      <strong>Team vesting</strong>
      <p>
        {sale?.teamVesting.enabled
          ? `${sale.teamVesting.durationSeconds}s (${sale.teamVesting.cliffSeconds}s cliff)`
          : 'Disabled'}
      </p>
    </div>
    <div>
      <strong>Liquidity lock</strong>
      <p>
        {sale?.liquidityLock.enabled
          ? `Locked until ${formatLockDate(sale.liquidityLock.lockUntil)}`
          : 'Not locked'}
      </p>
    </div>
    <div>
      <strong>Buy limits</strong>
      <p>{sale ? `${sale.minBuyAmount} - ${sale.maxBuyAmount} TON` : 'N/A'}</p>
    </div>
    <div>
      <strong>Whitelist</strong>
      <p>{sale ? `${sale.whitelistAddresses.length} wallets` : 'N/A'}</p>
    </div>
  </div>
);
