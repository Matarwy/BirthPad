import type { Project, Sale } from '../types';

interface SaleMetricsProps {
  project: Project;
  sale?: Sale;
}

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
  </div>
);
