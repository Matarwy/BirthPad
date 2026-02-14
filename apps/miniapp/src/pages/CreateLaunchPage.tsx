import { useState } from 'react';
import type { WalletSession } from '../types';

interface CreateLaunchPageProps {
  wallet: WalletSession | null;
  onCreate: (payload: {
    name: string;
    description: string;
    hardCap: string;
    softCap: string;
    tokenSymbol: string;
    tokenPrice: string;
    totalSupply: string;
    startsAt: string;
    endsAt: string;
  }) => Promise<void>;
}

const initialState = {
  name: '',
  description: '',
  hardCap: '',
  softCap: '',
  tokenSymbol: '',
  tokenPrice: '',
  totalSupply: '',
  startsAt: '',
  endsAt: '',
};

export const CreateLaunchPage = ({ wallet, onCreate }: CreateLaunchPageProps) => {
  const [form, setForm] = useState(initialState);
  const [status, setStatus] = useState('');

  return (
    <section className="panel-stack">
      <article className="card">
        <h2>Create launch</h2>
        <p>Founder flow to create a token sale directly from Telegram miniapp.</p>
        <div className="form-grid">
          {Object.keys(form).map((key) => (
            <label key={key}>
              {key}
              <input
                type={key.includes('At') ? 'datetime-local' : 'text'}
                value={form[key as keyof typeof form]}
                onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}
              />
            </label>
          ))}
        </div>
        <button
          disabled={!wallet}
          onClick={async () => {
            setStatus('Submitting...');
            try {
              await onCreate({
                ...form,
                startsAt: new Date(form.startsAt).toISOString(),
                endsAt: new Date(form.endsAt).toISOString(),
              });
              setStatus('Launch created');
              setForm(initialState);
            } catch (err) {
              setStatus(err instanceof Error ? err.message : 'Creation failed');
            }
          }}
        >
          Create
        </button>
        {status ? <p>{status}</p> : null}
      </article>
    </section>
  );
};
