import type { Project, Tx, WalletSession } from '../types';

interface PortfolioPageProps {
  wallet: WalletSession | null;
  txs: Tx[];
  projects: Project[];
}

export const PortfolioPage = ({ wallet, txs, projects }: PortfolioPageProps) => {
  const myTxs = txs.filter((tx) => tx.metadata.walletAddress === wallet?.address);

  return (
    <section className="panel-stack">
      <article className="card">
        <h2>Portfolio</h2>
        <p>{wallet ? `Connected wallet: ${wallet.address}` : 'Connect a wallet to view portfolio activity.'}</p>
        <ul className="list-reset">
          {myTxs.map((tx) => {
            const project = projects.find((item) => item.id === tx.projectId);
            return (
              <li key={tx.id} className="tx-item">
                <div>
                  <strong>{project?.name ?? tx.projectId}</strong>
                  <p>{tx.amount} TON · {tx.eventType}</p>
                </div>
                <span className={`pill ${tx.status}`}>{tx.status}</span>
              </li>
            );
          })}
        </ul>
        {!myTxs.length ? <p>No transactions yet.</p> : null}
      </article>
    </section>
  );
};
