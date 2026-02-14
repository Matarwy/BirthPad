import { useRef, useState } from 'react';
import type { WalletSession } from '../types';

interface CreateLaunchPageProps {
  wallet: WalletSession | null;
  createBlockedReason?: string | null;
  createWarningMessage?: string | null;
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
    buyLimits?: {
      minBuyAmount: string;
      maxBuyAmount: string;
    };
    whitelist?: {
      enabled: boolean;
      addresses: string[];
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
  minBuyAmount: '',
  maxBuyAmount: '',
  whitelistEnabled: false,
  whitelistAddresses: '',
};

export const CreateLaunchPage = ({
  wallet,
  createBlockedReason,
  createWarningMessage,
  onCreate,
}: CreateLaunchPageProps) => {
  const [form, setForm] = useState(initialState);
  const [status, setStatus] = useState('');
  const whitelistFileInput = useRef<HTMLInputElement>(null);
  const whitelistTokens = form.whitelistAddresses
    .split(/[\n,;\t ]/)
    .map((item) => item.trim())
    .filter(Boolean);
  const whitelistUniqueCount = new Set(whitelistTokens).size;

  return (
    <section className="panel-stack">
      <article className="card">
        <h2>Create launch</h2>
        <p className="hero-subtitle">
          Founder flow to create a token sale directly from Telegram mini app.
        </p>
        {createWarningMessage ? <p className="helper-text">{createWarningMessage}</p> : null}
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
            <input
              value={form.vestingCliffSeconds}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, vestingCliffSeconds: e.target.value }))
              }
            />
          </label>
          <label>
            durationSeconds
            <input
              value={form.vestingDurationSeconds}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, vestingDurationSeconds: e.target.value }))
              }
            />
          </label>
          <label>
            unlockStartAt
            <input
              type="datetime-local"
              value={form.vestingUnlockStartAt}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, vestingUnlockStartAt: e.target.value }))
              }
            />
          </label>
        </div>

        <h3>Liquidity lock</h3>
        <label>
          <input
            type="checkbox"
            checked={form.liquidityLockEnabled}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, liquidityLockEnabled: e.target.checked }))
            }
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

        <h3>Buy limits</h3>
        <div className="form-grid">
          <label>
            minBuyAmount
            <input
              value={form.minBuyAmount}
              onChange={(e) => setForm((prev) => ({ ...prev, minBuyAmount: e.target.value }))}
            />
          </label>
          <label>
            maxBuyAmount
            <input
              value={form.maxBuyAmount}
              onChange={(e) => setForm((prev) => ({ ...prev, maxBuyAmount: e.target.value }))}
            />
          </label>
        </div>

        <h3>Whitelist</h3>
        <label>
          <input
            type="checkbox"
            checked={form.whitelistEnabled}
            onChange={(e) => setForm((prev) => ({ ...prev, whitelistEnabled: e.target.checked }))}
          />
          Restrict sale to whitelist wallets
        </label>
        <label>
          whitelistAddresses
          <textarea
            value={form.whitelistAddresses}
            onChange={(e) => setForm((prev) => ({ ...prev, whitelistAddresses: e.target.value }))}
            placeholder="One wallet per line or comma-separated"
            rows={4}
          />
        </label>
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
              const csv = 'walletAddress\nEQ_example_wallet_1\nEQ_example_wallet_2\n';
              const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'whitelist-template.csv';
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            Export Template
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
            setForm((prev) => ({
              ...prev,
              whitelistAddresses: [...new Set(lines)].join('\n'),
            }));
            event.currentTarget.value = '';
          }}
        />
        <p className="helper-text">Whitelist parsed: {whitelistUniqueCount} unique wallets</p>

        <button
          className="primary-button"
          disabled={!wallet || Boolean(createBlockedReason)}
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
                  unlockStartAt: form.vestingUnlockStartAt
                    ? new Date(form.vestingUnlockStartAt).toISOString()
                    : undefined,
                },
                liquidityLock: {
                  enabled: form.liquidityLockEnabled,
                  lockUntil: form.liquidityLockUntil
                    ? new Date(form.liquidityLockUntil).toISOString()
                    : undefined,
                },
                buyLimits:
                  form.minBuyAmount || form.maxBuyAmount
                    ? {
                        minBuyAmount: form.minBuyAmount || '1',
                        maxBuyAmount: form.maxBuyAmount || form.hardCap,
                      }
                    : undefined,
                whitelist: form.whitelistEnabled
                  ? {
                      enabled: true,
                      addresses: form.whitelistAddresses
                        .split(/[\n,]/)
                        .map((item) => item.trim())
                        .filter(Boolean),
                    }
                  : { enabled: false, addresses: [] },
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
        {createBlockedReason ? <p className="error-text">{createBlockedReason}</p> : null}
        {status ? <p>{status}</p> : null}
      </article>
    </section>
  );
};
