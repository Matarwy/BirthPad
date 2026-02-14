import { useEffect, useState } from 'react';
import {
  acknowledgeOpsAlert,
  getDeploymentConfig,
  getDeploymentDrift,
  getOpsAlertHistory,
  getOpsAlerts,
  getOpsAnomalies,
  muteOpsAlert,
  unmuteOpsAlert,
} from '../lib/api';
import type {
  DeploymentConfigResponse,
  DeploymentDriftResponse,
  OpsAnomaliesResponse,
  OpsAlertHistoryResponse,
  OpsAlertsResponse,
  Tx,
  WalletSession,
} from '../types';

interface OpsPageProps {
  txs: Tx[];
  wallet: WalletSession | null;
}

export const OpsPage = ({ txs, wallet }: OpsPageProps) => {
  const [config, setConfig] = useState<DeploymentConfigResponse | null>(null);
  const [drift, setDrift] = useState<DeploymentDriftResponse | null>(null);
  const [alerts, setAlerts] = useState<OpsAlertsResponse | null>(null);
  const [anomalies, setAnomalies] = useState<OpsAnomaliesResponse | null>(null);
  const [history, setHistory] = useState<OpsAlertHistoryResponse | null>(null);
  const [status, setStatus] = useState('Loading deployment diagnostics...');
  const [actionStatus, setActionStatus] = useState('');
  const [actionReason, setActionReason] = useState('');

  const load = async () => {
    setStatus('Refreshing diagnostics...');
    try {
      const [configPayload, driftPayload, alertsPayload, anomaliesPayload, historyPayload] =
        await Promise.all([
          getDeploymentConfig(),
          getDeploymentDrift(),
          getOpsAlerts(),
          getOpsAnomalies(),
          getOpsAlertHistory(20),
        ]);
      setConfig(configPayload);
      setDrift(driftPayload);
      setAlerts(alertsPayload);
      setAnomalies(anomaliesPayload);
      setHistory(historyPayload);
      setStatus('Diagnostics up to date');
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Diagnostics unavailable');
    }
  };

  useEffect(() => {
    load().catch(() => undefined);
  }, []);

  const recentTxs = [...txs]
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
    .slice(0, 8);

  return (
    <section className="panel-stack">
      <article className="card ops-card">
        <div className="section-head">
          <h2>Ops Console</h2>
          <button className="ghost-button" onClick={load}>
            Refresh
          </button>
        </div>
        <p className="helper-text">{status}</p>
        <div className="metrics-grid">
          <div>
            <strong>Environment</strong>
            <p>{config?.deploymentEnv ?? 'n/a'}</p>
          </div>
          <div>
            <strong>TON Network</strong>
            <p>{config?.tonNetwork ?? 'n/a'}</p>
          </div>
          <div>
            <strong>Drift Severity</strong>
            <p className={`ops-severity-${drift?.severity ?? 'warning'}`}>
              {drift?.severity ?? 'unknown'}
            </p>
          </div>
          <div>
            <strong>Mismatch Count</strong>
            <p>{drift?.mismatchCount ?? 0}</p>
          </div>
          <div>
            <strong>Alert Severity</strong>
            <p className={`ops-severity-${alerts?.severity ?? 'warning'}`}>
              {alerts?.severity ?? 'unknown'}
            </p>
          </div>
        </div>
      </article>

      <article className="card">
        <h3>Live Alerts</h3>
        <label>
          Action reason
          <input
            value={actionReason}
            onChange={(event) => setActionReason(event.target.value)}
            placeholder="Optional reason for audit trail"
          />
        </label>
        <ul className="list-reset">
          {(alerts?.alerts ?? []).map((alert) => (
            <li key={alert.id} className="tx-item">
              <div>
                <strong>{alert.title}</strong>
                <p>
                  {alert.message}
                  {alert.acknowledgedAt
                    ? ` · acked ${new Date(alert.acknowledgedAt).toLocaleTimeString()}`
                    : ''}
                  {alert.acknowledgedBy ? ` by ${alert.acknowledgedBy}` : ''}
                  {alert.ackReason ? ` · reason: ${alert.ackReason}` : ''}
                  {alert.mutedUntil
                    ? ` · muted until ${new Date(alert.mutedUntil).toLocaleTimeString()}`
                    : ''}
                  {alert.mutedBy ? ` by ${alert.mutedBy}` : ''}
                  {alert.muteReason ? ` · reason: ${alert.muteReason}` : ''}
                </p>
              </div>
              <div className="row wrap">
                <span className={`pill ops-severity-${alert.severity}`}>{alert.severity}</span>
                <button
                  className="ghost-button"
                  onClick={async () => {
                    try {
                      if (!wallet) throw new Error('Connect admin wallet to acknowledge alerts');
                      setActionStatus(`Acknowledging ${alert.id}...`);
                      await acknowledgeOpsAlert(wallet, alert.id, actionReason || undefined);
                      await load();
                      setActionStatus(`Acknowledged ${alert.id}`);
                    } catch (err) {
                      setActionStatus(err instanceof Error ? err.message : 'Acknowledge failed');
                    }
                  }}
                  disabled={!wallet}
                >
                  Ack
                </button>
                {alert.mutedUntil ? (
                  <button
                    className="ghost-button"
                    onClick={async () => {
                      try {
                        if (!wallet) throw new Error('Connect admin wallet to unmute alerts');
                        setActionStatus(`Unmuting ${alert.id}...`);
                        await unmuteOpsAlert(wallet, alert.id);
                        await load();
                        setActionStatus(`Unmuted ${alert.id}`);
                      } catch (err) {
                        setActionStatus(err instanceof Error ? err.message : 'Unmute failed');
                      }
                    }}
                    disabled={!wallet}
                  >
                    Unmute
                  </button>
                ) : (
                  <button
                    className="ghost-button"
                    onClick={async () => {
                      try {
                        if (!wallet) throw new Error('Connect admin wallet to mute alerts');
                        setActionStatus(`Muting ${alert.id}...`);
                        await muteOpsAlert(wallet, alert.id, 60, actionReason || undefined);
                        await load();
                        setActionStatus(`Muted ${alert.id} for 60m`);
                      } catch (err) {
                        setActionStatus(err instanceof Error ? err.message : 'Mute failed');
                      }
                    }}
                    disabled={!wallet}
                  >
                    Mute 60m
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
        {!alerts?.alerts.length ? <p className="empty-state">No active alerts.</p> : null}
        <p className="helper-text">State file: {alerts?.statePath ?? 'n/a'}</p>
        {!wallet ? <p className="helper-text">Connect admin wallet for alert actions.</p> : null}
        {actionStatus ? <p className="helper-text">{actionStatus}</p> : null}
      </article>

      <article className="card">
        <h3>Anomaly Watch</h3>
        <div className="metrics-grid">
          <div>
            <strong>Buys</strong>
            <p>{anomalies?.totals.buy ?? 0}</p>
          </div>
          <div>
            <strong>Claims</strong>
            <p>{anomalies?.totals.claim ?? 0}</p>
          </div>
          <div>
            <strong>Refunds</strong>
            <p>{anomalies?.totals.refund ?? 0}</p>
          </div>
          <div>
            <strong>Finalizations</strong>
            <p>{anomalies?.totals.finalize ?? 0}</p>
          </div>
        </div>
        <p className="helper-text">
          Thresholds: refunds warn {anomalies?.thresholds.refundWarningCount ?? '-'} / critical{' '}
          {anomalies?.thresholds.refundCriticalCount ?? '-'}, drop-off lookback{' '}
          {anomalies?.thresholds.buyDropoffLookbackHours ?? '-'}h
        </p>
        <div className="trend-chart">
          {(anomalies?.buckets ?? []).map((bucket) => {
            const volume = bucket.buy + bucket.claim + bucket.refund + bucket.finalize;
            const height = Math.min(100, Math.max(8, volume * 14));
            return (
              <div key={bucket.label} className="trend-column">
                <div className="trend-bar" style={{ height: `${height}%` }} />
                <span>{bucket.label}</span>
              </div>
            );
          })}
        </div>
        <ul className="list-reset">
          {(anomalies?.anomalies ?? []).map((item) => (
            <li key={item.id} className="tx-item">
              <div>
                <strong>{item.title}</strong>
                <p>
                  {item.metric} · {item.details}
                </p>
              </div>
              <span className={`pill ops-severity-${item.severity}`}>{item.severity}</span>
            </li>
          ))}
        </ul>
        {!anomalies?.anomalies.length ? (
          <p className="empty-state">No anomaly thresholds triggered.</p>
        ) : null}
      </article>

      <article className="card">
        <h3>Active Contracts</h3>
        <ul className="list-reset">
          <li className="tx-item">
            <div>
              <strong>LaunchFactory</strong>
              <p>{config?.contracts.launchFactory || 'missing'}</p>
            </div>
            <span className={`pill ${config?.health.hasLaunchFactory ? 'confirmed' : 'refunded'}`}>
              {config?.health.hasLaunchFactory ? 'ready' : 'missing'}
            </span>
          </li>
          <li className="tx-item">
            <div>
              <strong>ProjectSale Template</strong>
              <p>{config?.contracts.projectSaleTemplate || 'missing'}</p>
            </div>
            <span
              className={`pill ${config?.health.hasProjectSaleTemplate ? 'confirmed' : 'refunded'}`}
            >
              {config?.health.hasProjectSaleTemplate ? 'ready' : 'missing'}
            </span>
          </li>
        </ul>
      </article>

      <article className="card">
        <h3>Drift Checks</h3>
        <ul className="list-reset">
          {(drift?.checks ?? []).map((check) => (
            <li key={check.field} className="tx-item">
              <div>
                <strong>{check.field}</strong>
                <p>
                  env: {check.envValue || 'empty'} | registry: {check.registryValue || 'empty'}
                </p>
              </div>
              <span className={`pill ${check.matches ? 'confirmed' : 'refunded'}`}>
                {check.matches ? 'match' : 'mismatch'}
              </span>
            </li>
          ))}
        </ul>
      </article>

      <article className="card">
        <h3>Recent Chain Activity</h3>
        <ul className="list-reset">
          {recentTxs.map((tx) => (
            <li key={tx.id} className="tx-item">
              <div>
                <strong>{tx.eventType}</strong>
                <p>
                  {tx.amount} TON · {tx.txHash.slice(0, 14)}...
                </p>
              </div>
              <span className={`pill ${tx.status}`}>{tx.status}</span>
            </li>
          ))}
        </ul>
        {!recentTxs.length ? <p className="empty-state">No indexed activity yet.</p> : null}
      </article>

      <article className="card">
        <h3>Incident Timeline</h3>
        <ul className="list-reset">
          {(alerts?.incidents ?? []).map((incident) => (
            <li key={incident.id} className="tx-item">
              <div>
                <strong>{incident.type}</strong>
                <p>
                  {incident.message} · {new Date(incident.createdAt).toLocaleString()}
                </p>
              </div>
              <span className={`pill ops-severity-${incident.severity}`}>{incident.severity}</span>
            </li>
          ))}
        </ul>
        {!alerts?.incidents.length ? <p className="empty-state">No incidents recorded.</p> : null}
      </article>

      <article className="card">
        <h3>Alert Action History</h3>
        <ul className="list-reset">
          {(history?.items ?? []).map((item) => (
            <li key={item.id} className="tx-item">
              <div>
                <strong>
                  {item.action} · {item.alertId}
                </strong>
                <p>
                  {item.actor} · {new Date(item.createdAt).toLocaleString()}
                  {item.reason ? ` · ${item.reason}` : ''}
                </p>
              </div>
              <span className="pill">{item.action}</span>
            </li>
          ))}
        </ul>
        {!history?.items.length ? <p className="empty-state">No alert actions yet.</p> : null}
      </article>
    </section>
  );
};
