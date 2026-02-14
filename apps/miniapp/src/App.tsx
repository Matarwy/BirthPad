import { useEffect, useMemo, useState } from 'react';
import { bindThemeSync, initTelegram } from './lib/telegram';
import {
  buyLaunch,
  createLaunch,
  getProjectDetail,
  getProjects,
  getSales,
  getTransactions,
  loginWithTelegram,
} from './lib/api';
import { connectWallet, connector, disconnectWallet, loadWalletSession, saveWalletSession } from './lib/wallet';
import { LaunchListPage } from './pages/LaunchListPage';
import { LaunchDetailPage } from './pages/LaunchDetailPage';
import { CreateLaunchPage } from './pages/CreateLaunchPage';
import { PortfolioPage } from './pages/PortfolioPage';
import type { Project, ProjectDetailResponse, Sale, Tx, WalletSession } from './types';

type Route = 'launches' | 'launch-detail' | 'create' | 'portfolio';

const App = () => {
  const telegram = useMemo(() => initTelegram(), []);
  const [theme, setTheme] = useState(telegram.colorScheme);
  const [route, setRoute] = useState<Route>('launches');
  const [projects, setProjects] = useState<Project[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [selectedLaunchId, setSelectedLaunchId] = useState<string>('');
  const [detail, setDetail] = useState<ProjectDetailResponse>();
  const [wallet, setWallet] = useState<WalletSession | null>(() => loadWalletSession());
  const [loading, setLoading] = useState(true);
  const [txStatus, setTxStatus] = useState('');

  const refresh = async () => {
    setLoading(true);
    const [projectData, saleData, txData] = await Promise.all([getProjects('trending'), getSales(), getTransactions()]);
    setProjects(projectData);
    setSales(saleData);
    setTxs(txData);
    setLoading(false);
  };

  useEffect(() => {
    loginWithTelegram(telegram.initData).catch(() => undefined);
    connector.restoreConnection().catch(() => undefined);
    refresh().catch(() => setLoading(false));
    const unbindTheme = bindThemeSync(setTheme);
    return () => {
      unbindTheme();
    };
  }, [telegram.initData]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (selectedLaunchId) {
        getProjectDetail(selectedLaunchId).then(setDetail).catch(() => undefined);
      }
      getTransactions().then(setTxs).catch(() => undefined);
    }, 4000);
    return () => window.clearInterval(interval);
  }, [selectedLaunchId]);

  useEffect(() => {
    saveWalletSession(wallet);
  }, [wallet]);

  const openLaunch = async (projectId: string) => {
    setSelectedLaunchId(projectId);
    setRoute('launch-detail');
    const data = await getProjectDetail(projectId);
    setDetail(data);
  };

  const connect = async () => {
    const universalLink = await connectWallet();
    if (telegram.isTelegram) {
      window.open(universalLink, '_blank');
    }

    connector.onStatusChange((connectedWallet) => {
      if (!connectedWallet?.account.address) return;
      setWallet({
        address: connectedWallet.account.address,
        connectedAt: new Date().toISOString(),
        provider: 'tonconnect',
      });
    });
  };

  return (
    <main className={`container ${theme === 'light' ? 'light' : ''}`}>
      <header className="topbar">
        <div>
          <h1>BirthPad</h1>
          <p>
            {telegram.user ? `Hi, ${telegram.user.first_name}` : 'Guest'} · Theme: {theme}
          </p>
        </div>
        <div className="row">
          {wallet ? (
            <>
              <span className="pill connected">{wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}</span>
              <button onClick={() => disconnectWallet().then(() => setWallet(null))}>Disconnect</button>
            </>
          ) : (
            <button onClick={connect}>Connect TON Wallet</button>
          )}
        </div>
      </header>

      <nav className="tabs">
        <button onClick={() => setRoute('launches')}>Launches</button>
        <button onClick={() => setRoute('create')}>Create</button>
        <button onClick={() => setRoute('portfolio')}>Portfolio</button>
      </nav>

      {route === 'launches' ? (
        <LaunchListPage projects={projects} sales={sales} loading={loading} onOpen={openLaunch} onRefresh={refresh} />
      ) : null}
      {route === 'launch-detail' ? (
        <LaunchDetailPage
          detail={detail}
          wallet={wallet}
          transactionStatus={txStatus}
          onBuy={async (amount) => {
            if (!wallet || !selectedLaunchId) throw new Error('Connect wallet first');
            setTxStatus('Submitting...');
            const result = await buyLaunch(wallet, selectedLaunchId, amount);
            setTxStatus(`Queued: ${result.txHash}`);

            let attempts = 8;
            const poll = window.setInterval(async () => {
              const current = await getTransactions();
              setTxs(current);
              const match = current.find((tx) => tx.txHash === result.txHash);
              if (match) setTxStatus(match.status);
              attempts -= 1;
              if (match?.status === 'confirmed' || attempts === 0) {
                window.clearInterval(poll);
                if (attempts === 0) setTxStatus('Timed out while waiting for confirmation');
              }
            }, 2500);
          }}
        />
      ) : null}
      {route === 'create' ? <CreateLaunchPage wallet={wallet} onCreate={(payload) => createLaunch(wallet!, payload).then(refresh)} /> : null}
      {route === 'portfolio' ? <PortfolioPage wallet={wallet} txs={txs} projects={projects} /> : null}
    </main>
  );
};

export default App;
