import { useMemo } from 'react';
import WebApp from '@twa-dev/sdk';

const App = () => {
  const user = useMemo(() => {
    WebApp.ready();
    WebApp.expand();
    return WebApp.initDataUnsafe?.user;
  }, []);

  return (
    <main className="container">
      <h1>BirthPad Telegram Mini App</h1>
      <p>Telegram WebApp SDK is initialized and ready.</p>
      <section className="card">
        <h2>Session</h2>
        <p>
          <strong>User:</strong> {user ? `${user.first_name} ${user.last_name ?? ''}`.trim() : 'Guest'}
        </p>
        <p>
          <strong>Theme:</strong> {WebApp.colorScheme}
        </p>
      </section>
    </main>
  );
};

export default App;
