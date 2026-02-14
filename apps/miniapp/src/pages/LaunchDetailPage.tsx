import { useMemo, useRef, useState } from 'react';
import { CountdownTimer } from '../components/CountdownTimer';
import { ProgressBar } from '../components/ProgressBar';
import { SaleMetrics } from '../components/SaleMetrics';
import type { ProjectDetailResponse, WalletSession } from '../types';

interface LaunchDetailPageProps {
  detail?: ProjectDetailResponse;
  wallet: WalletSession | null;
  transactionStatus: string;
  onBuy: (amount: string) => Promise<void>;
  onPause: () => Promise<void>;
  onResume: () => Promise<void>;
  onFinalize: () => Promise<void>;
  onRefund: () => Promise<void>;
  onWhitelistUpdate: (addresses: string[]) => Promise<void>;
}

export const LaunchDetailPage = ({
  detail,
  wallet,
  transactionStatus,
  onBuy,
  onPause,
  onResume,
  onFinalize,
  onRefund,
  onWhitelistUpdate,
}: LaunchDetailPageProps) => {
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [actionStatus, setActionStatus] = useState('');
  const [whitelistDraft, setWhitelistDraft] = useState('');
  const whitelistFileInput = useRef<HTMLInputElement>(null);

  const progress = useMemo(() => detail?.progress?.progress ?? 0, [detail?.progress?.progress]);

  if (!detail) return <p className="empty-state">Select a launch to view details.</p>;

  const buyDisabled = !wallet || !amount || Number(amount) <= 0 || detail.sale?.state !== 'active';
  const saleState = detail.sale?.state ?? 'upcoming';
  const saleEnded = detail.sale ? new Date(detail.sale.endsAt).getTime() < Date.now() : false;
  const riskScore = detail.risk?.score ?? 100;
  const riskTier = riskScore >= 75 ? 'low' : riskScore >= 45 ? 'medium' : 'high';
  const draftWallets = whitelistDraft
    .split(/[\n,;\t ]/)
    .map((item) => item.trim())
    .filter(Boolean);
  const uniqueDraftWallets = [...new Set(draftWallets)];

  return (
    <section className="panel-stack">
      <article className="card launch-card">
        <div className="section-head">
          <h2>{detail.project.name}</h2>
          <span className={`pill state-${saleState}`}>{saleState}</span>
        </div>
        <p>{detail.project.description}</p>
        <SaleMetrics project={detail.project} sale={detail.sale} />
        <ProgressBar value={progress} label="Funding progress" />
        {detail.sale ? (
          <p className="countdown-line">
            Time left: <CountdownTimer targetIso={detail.sale.endsAt} />
          </p>
        ) : null}
      </article>

      <article className={`card risk-card risk-${riskTier}`}>
        <div className="section-head">
          <h3>Risk monitor</h3>
          <span className={`pill risk-pill risk-${riskTier}`}>{riskTier} risk</span>
        </div>
        <p className="helper-text">Live heuristics from contribution and sale behavior.</p>
        <div className="metrics-grid">
          <div>
            <strong>Score</strong>
            <p>{riskScore}/100</p>
          </div>
          <div>
            <strong>Top wallet share</strong>
            <p>{detail.risk?.topWalletShare ?? 0}%</p>
          </div>
          <div>
            <strong>Unique contributors</strong>
            <p>{detail.risk?.uniqueContributors ?? 0}</p>
          </div>
          <div>
            <strong>Whitelist size</strong>
            <p>{detail.risk?.whitelistSize ?? 0}</p>
          </div>
        </div>
        <ul className="risk-flags">
          {(detail.risk?.flags.length ? detail.risk.flags : ['healthy_signal']).map((flag) => (
            <li key={flag} className="pill">
              {flag.replaceAll('_', ' ')}
            </li>
          ))}
        </ul>
      </article>

      <article className="card">
        <h3>Participate in sale</h3>
        {detail.sale ? (
          <p className="helper-text">
            Buy range: {detail.sale.minBuyAmount} - {detail.sale.maxBuyAmount} TON
          </p>
        ) : null}
        <label htmlFor="buy-amount">Amount (TON)</label>
        <input
          id="buy-amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="10"
        />
        <button
          className="primary-button"
          disabled={buyDisabled}
          onClick={async () => {
            setError(null);
            setConfirming(true);
          }}
        >
          Buy tokens
        </button>
        {!wallet ? <p className="helper-text">Connect wallet to buy.</p> : null}
        {detail.sale?.state === 'paused' ? (
          <p className="helper-text">Sale is paused by owner/admin.</p>
        ) : null}
        {transactionStatus ? <p>Transaction status: {transactionStatus}</p> : null}
        {error ? <p className="error-text">{error}</p> : null}
      </article>

      <article className="card">
        <h3>Lifecycle controls</h3>
        <p className="helper-text">Owner or admin actions. Backend enforces permissions.</p>
        <div className="row wrap">
          <button
            className="ghost-button"
            disabled={!wallet || saleState !== 'active'}
            onClick={async () => {
              setActionStatus('Pausing...');
              try {
                await onPause();
                setActionStatus('Sale paused');
              } catch (err) {
                setActionStatus(err instanceof Error ? err.message : 'Pause failed');
              }
            }}
          >
            Pause
          </button>
          <button
            className="ghost-button"
            disabled={!wallet || saleState !== 'paused' || saleEnded}
            onClick={async () => {
              setActionStatus('Resuming...');
              try {
                await onResume();
                setActionStatus('Sale resumed');
              } catch (err) {
                setActionStatus(err instanceof Error ? err.message : 'Resume failed');
              }
            }}
          >
            Resume
          </button>
          <button
            className="ghost-button"
            disabled={!wallet || saleState !== 'active'}
            onClick={async () => {
              setActionStatus('Finalizing...');
              try {
                await onFinalize();
                setActionStatus('Finalization queued');
              } catch (err) {
                setActionStatus(err instanceof Error ? err.message : 'Finalize failed');
              }
            }}
          >
            Finalize
          </button>
          <button
            className="ghost-button danger-button"
            disabled={!wallet || saleState !== 'active'}
            onClick={async () => {
              setActionStatus('Refunding...');
              try {
                await onRefund();
                setActionStatus('Refund queued');
              } catch (err) {
                setActionStatus(err instanceof Error ? err.message : 'Refund failed');
              }
            }}
          >
            Refund
          </button>
        </div>
        {actionStatus ? <p>{actionStatus}</p> : null}
      </article>

      <article className="card">
        <h3>Whitelist manager</h3>
        <p className="helper-text">
          Current whitelist: {detail.sale?.whitelistAddresses.length ?? 0} wallets
        </p>
        <textarea
          value={whitelistDraft}
          onChange={(e) => setWhitelistDraft(e.target.value)}
          placeholder="Paste wallets (comma or new line)"
          rows={4}
        />
        <div className="row wrap">
          <button
            type="button"
            className="ghost-button"
            onClick={() => whitelistFileInput.current?.click()}
          >
            Import CSV
          </button>
          <button
            type="button"
            className="ghost-button"
            onClick={() => {
              const csv =
                'walletAddress\n' +
                (detail.sale?.whitelistAddresses.length
                  ? detail.sale.whitelistAddresses.join('\n')
                  : 'EQ_example_wallet_1\n');
              const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `${detail.project.name}-whitelist.csv`;
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            Export CSV
          </button>
        </div>
        <input
          ref={whitelistFileInput}
          type="file"
          accept=".csv,text/csv"
          className="hidden-input"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            const raw = await file.text();
            const lines = raw
              .split(/\r?\n/)
              .map((line) => line.trim())
              .filter(Boolean)
              .filter((line) => !line.toLowerCase().includes('walletaddress'));
            setWhitelistDraft([...new Set(lines)].join('\n'));
            event.currentTarget.value = '';
          }}
        />
        <p className="helper-text">Parsed wallets: {uniqueDraftWallets.length} unique</p>
        <button
          className="ghost-button"
          disabled={!wallet}
          onClick={async () => {
            setActionStatus('Updating whitelist...');
            try {
              await onWhitelistUpdate(uniqueDraftWallets);
              setActionStatus(`Whitelist updated (${uniqueDraftWallets.length} wallets)`);
            } catch (err) {
              setActionStatus(err instanceof Error ? err.message : 'Whitelist update failed');
            }
          }}
        >
          Update whitelist
        </button>
      </article>

      {confirming ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal">
            <h4>Confirm purchase</h4>
            <p>
              Buy with <strong>{amount} TON</strong> from{' '}
              <code>{wallet?.address ?? 'No wallet'}</code>?
            </p>
            <div className="modal-actions">
              <button className="ghost-button" onClick={() => setConfirming(false)}>
                Cancel
              </button>
              <button
                className="primary-button"
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
