import { useMemo, useState } from 'react';
import { CountdownTimer } from '../components/CountdownTimer';
import { ProgressBar } from '../components/ProgressBar';
import { SaleMetrics } from '../components/SaleMetrics';
import type { ProjectDetailResponse, WalletSession } from '../types';

interface LaunchDetailPageProps {
  detail?: ProjectDetailResponse;
  wallet: WalletSession | null;
  transactionStatus: string;
  onBuy: (amount: string) => Promise<void>;
}

export const LaunchDetailPage = ({ detail, wallet, transactionStatus, onBuy }: LaunchDetailPageProps) => {
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const progress = useMemo(() => detail?.progress?.progress ?? 0, [detail?.progress?.progress]);

  if (!detail) return <p>Select a launch to view details.</p>;

  const buyDisabled = !wallet || !amount || Number(amount) <= 0;

  return (
    <section className="panel-stack">
      <article className="card">
        <h2>{detail.project.name}</h2>
        <p>{detail.project.description}</p>
        <SaleMetrics project={detail.project} sale={detail.sale} />
        <ProgressBar value={progress} label="Funding progress" />
        {detail.sale ? (
          <p>
            Time left: <CountdownTimer targetIso={detail.sale.endsAt} />
          </p>
        ) : null}
      </article>

      <article className="card">
        <h3>Participate in sale</h3>
        <label htmlFor="buy-amount">Amount (TON)</label>
        <input id="buy-amount" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="10" />
        <button
          disabled={buyDisabled}
          onClick={async () => {
            setError(null);
            setConfirming(true);
          }}
        >
          Buy tokens
        </button>
        {transactionStatus ? <p>Transaction status: {transactionStatus}</p> : null}
        {error ? <p className="error-text">{error}</p> : null}
      </article>

      {confirming ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal">
            <h4>Confirm purchase</h4>
            <p>
              Buy with <strong>{amount} TON</strong> from <code>{wallet?.address ?? 'No wallet'}</code>?
            </p>
            <div className="modal-actions">
              <button onClick={() => setConfirming(false)}>Cancel</button>
              <button
                disabled={buyDisabled}
                onClick={async () => {
                  try {
                    await onBuy(amount);
                    setConfirming(false);
                    setAmount('');
                  } catch (err) {
                    setError(err instanceof Error ? err.message : 'Buy failed');
                  }
                }}
              >
                Confirm & send
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
};
