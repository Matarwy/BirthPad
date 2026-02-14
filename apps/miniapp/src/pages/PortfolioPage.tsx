import { useEffect, useState } from 'react';
import { claimProjectTokens, getClaimableForProject } from '../lib/api';
import type { ClaimableStats, Project, Tx, WalletSession } from '../types';

interface PortfolioPageProps {
  wallet: WalletSession | null;
  txs: Tx[];
  projects: Project[];
  onDataChanged: () => Promise<void>;
}

export const PortfolioPage = ({ wallet, txs, projects, onDataChanged }: PortfolioPageProps) => {
  const myTxs = txs.filter((tx) => tx.metadata.walletAddress === wallet?.address);
  const [claimables, setClaimables] = useState<Record<string, ClaimableStats>>({});
  const [claimStatus, setClaimStatus] = useState('');
  const [loadingClaims, setLoadingClaims] = useState(false);

  useEffect(() => {
    if (!wallet || !projects.length) {
      setClaimables({});
      return;
    }

    setLoadingClaims(true);
    Promise.all(
      projects.map(async (project) => {
        try {
          const stats = await getClaimableForProject(wallet, project.id);
          return [project.id, stats] as const;
        } catch {
          return undefined;
        }
      }),
    )
      .then((entries) => {
        const next: Record<string, ClaimableStats> = {};
        for (const item of entries) {
          if (!item) continue;
          next[item[0]] = item[1];
        }
        setClaimables(next);
      })
      .finally(() => setLoadingClaims(false));
  }, [wallet, projects]);

  return (
    <section className="panel-stack">
      <article className="card">
        <h2>Claim center</h2>
        <p className="helper-text">Claim unlocked allocations from finalized launches.</p>
        {loadingClaims ? <p className="empty-state">Loading claimable balances...</p> : null}
        <ul className="list-reset">
          {projects.map((project) => {
            const stats = claimables[project.id];
            if (!stats || Number(stats.claimableAmount) <= 0) return null;
            return (
              <li key={project.id} className="tx-item">
                <div>
                  <strong>{project.name}</strong>
                  <p>
                    Claimable {stats.claimableAmount} · Unlocked {stats.unlockedAmount} · Claimed{' '}
                    {stats.claimedAmount}
                  </p>
                </div>
                <button
                  className="primary-button"
                  disabled={!wallet}
                  onClick={async () => {
                    if (!wallet) return;
                    setClaimStatus(`Claiming ${project.name}...`);
                    try {
                      const result = await claimProjectTokens(wallet, project.id);
                      setClaimStatus(`Claimed ${result.claimedAmount} from ${project.name}`);
                      await onDataChanged();
                      const updated = await getClaimableForProject(wallet, project.id);
                      setClaimables((prev) => ({ ...prev, [project.id]: updated }));
                    } catch (err) {
                      setClaimStatus(err instanceof Error ? err.message : 'Claim failed');
                    }
                  }}
                >
                  Claim
                </button>
              </li>
            );
          })}
        </ul>
        {!loadingClaims &&
        !Object.values(claimables).some((stats) => Number(stats.claimableAmount) > 0) ? (
          <p className="empty-state">No claimable balances yet.</p>
        ) : null}
        {claimStatus ? <p>{claimStatus}</p> : null}
      </article>

      <article className="card">
        <h2>Portfolio</h2>
        <p>
          {wallet
            ? `Connected wallet: ${wallet.address}`
            : 'Connect a wallet to view portfolio activity.'}
        </p>
        <ul className="list-reset">
          {myTxs.map((tx) => {
            const project = projects.find((item) => item.id === tx.projectId);
            return (
              <li key={tx.id} className="tx-item">
                <div>
                  <strong>{project?.name ?? tx.projectId}</strong>
                  <p>
                    {tx.amount} TON · {tx.eventType}
                  </p>
                </div>
                <span className={`pill ${tx.status}`}>{tx.status}</span>
              </li>
            );
          })}
        </ul>
        {!myTxs.length ? <p className="empty-state">No transactions yet.</p> : null}
      </article>
    </section>
  );
};
