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
    teamVesting: {
      enabled: boolean;
      cliffSeconds: number;
      durationSeconds: number;
      unlockStartAt?: string;
    };
    liquidityLock: {
      enabled: boolean;
      lockUntil?: string;
    };
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
  vestingEnabled: false,
  vestingCliffSeconds: '0',
  vestingDurationSeconds: '0',
  vestingUnlockStartAt: '',
  liquidityLockEnabled: false,
  liquidityLockUntil: '',
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
          {[
            'name',
            'description',
            'hardCap',
            'softCap',
            'tokenSymbol',
            'tokenPrice',
            'totalSupply',
            'startsAt',
            'endsAt',
          ].map((key) => (
            <label key={key}>
              {key}
              <input
                type={key.includes('At') ? 'datetime-local' : 'text'}
                value={form[key as keyof typeof form] as string}
                onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}
              />
            </label>
          ))}
        </div>

        <h3>Team vesting</h3>
        <label>
          <input
            type="checkbox"
            checked={form.vestingEnabled}
            onChange={(e) => setForm((prev) => ({ ...prev, vestingEnabled: e.target.checked }))}
          />
          Enable team vesting
        </label>
        <div className="form-grid">
          <label>
            cliffSeconds
            <input value={form.vestingCliffSeconds} onChange={(e) => setForm((prev) => ({ ...prev, vestingCliffSeconds: e.target.value }))} />
          </label>
          <label>
            durationSeconds
            <input value={form.vestingDurationSeconds} onChange={(e) => setForm((prev) => ({ ...prev, vestingDurationSeconds: e.target.value }))} />
          </label>
          <label>
            unlockStartAt
            <input
              type="datetime-local"
              value={form.vestingUnlockStartAt}
              onChange={(e) => setForm((prev) => ({ ...prev, vestingUnlockStartAt: e.target.value }))}
            />
          </label>
        </div>

        <h3>Liquidity lock</h3>
        <label>
          <input
            type="checkbox"
            checked={form.liquidityLockEnabled}
            onChange={(e) => setForm((prev) => ({ ...prev, liquidityLockEnabled: e.target.checked }))}
          />
          Enable liquidity lock
        </label>
        <label>
          lockUntil
          <input
            type="datetime-local"
            value={form.liquidityLockUntil}
            onChange={(e) => setForm((prev) => ({ ...prev, liquidityLockUntil: e.target.value }))}
          />
        </label>

        <button
          disabled={!wallet}
          onClick={async () => {
            setStatus('Submitting...');
            try {
              await onCreate({
                name: form.name,
                description: form.description,
                hardCap: form.hardCap,
                softCap: form.softCap,
                tokenSymbol: form.tokenSymbol,
                tokenPrice: form.tokenPrice,
                totalSupply: form.totalSupply,
                startsAt: new Date(form.startsAt).toISOString(),
                endsAt: new Date(form.endsAt).toISOString(),
                teamVesting: {
                  enabled: form.vestingEnabled,
                  cliffSeconds: Number(form.vestingCliffSeconds),
                  durationSeconds: Number(form.vestingDurationSeconds),
                  unlockStartAt: form.vestingUnlockStartAt ? new Date(form.vestingUnlockStartAt).toISOString() : undefined,
                },
                liquidityLock: {
                  enabled: form.liquidityLockEnabled,
                  lockUntil: form.liquidityLockUntil ? new Date(form.liquidityLockUntil).toISOString() : undefined,
                },
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
