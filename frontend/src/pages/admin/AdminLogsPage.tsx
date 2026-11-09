import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '@/api/client';
import { getSecuritySummary, listAuditLogs, listLoginHistory } from '@/api/admin';
import usePolling from '@/hooks/usePolling';
import type {
  AuditLogEntry,
  AuditLogFilters,
  AuditSeverity,
  LoginHistoryEntry,
  SecuritySummary,
} from '@/api/admin';
import { formatDateTime } from '@/utils/format';

const TABS = [
  { id: 'audit', label: 'Audit log' },
  { id: 'logins', label: 'Login history' },
  { id: 'security', label: 'Security' },
] as const;

type TabId = (typeof TABS)[number]['id'];

const severityBadge = (severity: string) => (
  <span
    className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
      severity === 'ERROR'
        ? 'bg-red-100 text-red-700'
        : severity === 'WARN'
          ? 'bg-amber-100 text-amber-800'
          : 'bg-emerald-100 text-emerald-700'
    }`}
  >
    {severity}
  </span>
);

const AdminLogsPage = () => {
  const [tab, setTab] = useState<TabId>('audit');

  // Audit log state
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [severity, setSeverity] = useState<AuditSeverity | ''>('');
  const [actorId, setActorId] = useState('');
  const [action, setAction] = useState('');
  const [entityType, setEntityType] = useState('');
  const [logsLoading, setLogsLoading] = useState(false);
  const [logError, setLogError] = useState<string>();

  // Login history state
  const [logins, setLogins] = useState<LoginHistoryEntry[]>([]);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginsLoading, setLoginsLoading] = useState(false);
  const [loginError, setLoginError] = useState<string>();

  // Security state
  const [summary, setSummary] = useState<SecuritySummary>();
  const [incidents, setIncidents] = useState<AuditLogEntry[]>([]);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string>();

  const loadLogs = async (silent = false) => {
    if (!silent) setLogsLoading(true);
    setLogError(undefined);
    try {
      const filters: AuditLogFilters = {
        severity: severity || undefined,
        actorId: actorId.trim() || undefined,
        action: action.trim() || undefined,
        entityType: entityType.trim() || undefined,
      };
      setLogs(await listAuditLogs(filters));
    } catch (err) {
      setLogError(err instanceof ApiError ? err.message : 'Unable to load audit logs.');
    } finally {
      setLogsLoading(false);
    }
  };

  const loadLogins = useCallback(async (email = loginEmail) => {
    setLoginsLoading(true);
    setLoginError(undefined);
    try {
      setLogins(await listLoginHistory(email.trim()));
    } catch (err) {
      setLoginError(err instanceof ApiError ? err.message : 'Unable to load login history.');
    } finally {
      setLoginsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadSecurity = useCallback(async () => {
    setSummaryLoading(true);
    setSummaryError(undefined);
    try {
      const [nextSummary, events] = await Promise.all([
        getSecuritySummary(),
        listAuditLogs(),
      ]);
      setSummary(nextSummary);
      setIncidents(events.filter((entry) => entry.severity !== 'INFO').slice(0, 25));
    } catch (err) {
      setSummaryError(err instanceof ApiError ? err.message : 'Unable to load security data.');
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [severity, actorId, action, entityType]);

  // Keep the audit log current without a manual reload.
  usePolling(() => {
    if (tab === 'audit') void loadLogs(true);
  });

  useEffect(() => {
    if (tab === 'logins' && logins.length === 0) void loadLogins();
    if (tab === 'security' && !summary) void loadSecurity();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const summaryCards = summary && [
    { label: 'Failed logins (24h)', value: summary.failedLogins24h, detail: `${summary.failedLogins1h} in the last hour`, tone: summary.failedLogins24h > 0 ? 'text-amber-600' : 'text-ink' },
    { label: 'Successful logins (24h)', value: summary.successfulLogins24h, detail: 'user sign-ins recorded', tone: 'text-ink' },
    { label: 'Login spikes (24h)', value: summary.loginSpikes24h, detail: '5+ failures within 5 minutes', tone: summary.loginSpikes24h > 0 ? 'text-red-600' : 'text-ink' },
    { label: 'Warnings / errors (24h)', value: summary.warnings24h + summary.errors24h, detail: `${summary.errors24h} errors · ${summary.warnings24h} warnings`, tone: summary.errors24h > 0 ? 'text-red-600' : 'text-ink' },
  ];

  return (
    <section className="flex flex-col gap-6">
      <header>
        <h1 className="text-3xl font-semibold text-primary">Audit &amp; security</h1>
      </header>

      <div className="flex flex-wrap gap-2">
        {TABS.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => setTab(option.id)}
            className={`rounded-full px-4 py-2 text-xs font-semibold transition-colors ${
              tab === option.id
                ? 'bg-primary text-ink'
                : 'border border-surface-line bg-white text-muted hover:bg-surface-card'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {tab === 'audit' && (
        <>
          <form
            className="flex flex-wrap gap-3"
            onSubmit={(event) => { event.preventDefault(); void loadLogs(); }}
          >
            <label className="flex items-center gap-2 text-sm">
              Severity
              <select value={severity} onChange={(event) => setSeverity(event.target.value as AuditSeverity | '')} className="rounded-xl border border-surface-line bg-white px-3 py-2">
                <option value="">All</option><option value="INFO">INFO</option><option value="WARN">WARN</option><option value="ERROR">ERROR</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm">
              Actor ID
              <input value={actorId} onChange={(event) => setActorId(event.target.value)} inputMode="numeric" className="w-36 rounded-xl border border-surface-line bg-white px-3 py-2" />
            </label>
            <input
              aria-label="Action"
              value={action}
              onChange={(event) => setAction(event.target.value)}
              placeholder="Action (e.g. LOGIN)"
              className="w-48 rounded-xl border border-surface-line bg-white px-3 py-2"
            />
            <input
              aria-label="Entity type"
              value={entityType}
              onChange={(event) => setEntityType(event.target.value)}
              placeholder="Entity type"
              className="w-44 rounded-xl border border-surface-line bg-white px-3 py-2"
            />
            <button type="submit" className="rounded-xl bg-primary px-4 py-2 font-semibold text-ink">Filter</button>
          </form>
          {logError && <p role="alert" className="text-sm text-red-700">{logError}</p>}
          <div className="overflow-x-auto rounded-2xl border border-surface-line bg-white">
            {logsLoading ? (
              <p role="status" className="p-6 text-sm text-muted">Loading logs…</p>
            ) : (
              <table className="w-full min-w-[800px] text-left text-sm">
                <thead className="bg-surface-soft text-muted">
                  <tr><th className="px-4 py-3">Time</th><th className="px-4 py-3">Severity</th><th className="px-4 py-3">Actor ID</th><th className="px-4 py-3">Action</th><th className="px-4 py-3">Entity</th><th className="px-4 py-3">Details</th></tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="border-t border-surface-line align-top">
                      <td className="whitespace-nowrap px-4 py-3">{log.createdAt ? formatDateTime(log.createdAt) : '—'}</td>
                      <td className="px-4 py-3">{severityBadge(log.severity)}</td>
                      <td className="px-4 py-3">{log.actorId ?? '—'}</td>
                      <td className="px-4 py-3">{log.action}</td>
                      <td className="px-4 py-3">{log.entityType}{log.entityId ? ` #${log.entityId}` : ''}</td>
                      <td className="max-w-sm whitespace-pre-wrap break-words px-4 py-3 text-xs">{JSON.stringify(log.details)}</td>
                    </tr>
                  ))}
                  {logs.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-muted">No audit events match these filters.</td></tr>}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {tab === 'logins' && (
        <>
          <form
            className="flex flex-wrap gap-2"
            onSubmit={(event) => { event.preventDefault(); void loadLogins(); }}
          >
            <input
              aria-label="Filter by email"
              value={loginEmail}
              onChange={(event) => setLoginEmail(event.target.value)}
              placeholder="Filter by email"
              className="min-w-[220px] flex-1 rounded-xl border border-surface-line bg-white px-4 py-3 outline-none focus:border-primary"
            />
            <button type="submit" className="rounded-xl bg-primary px-5 font-semibold text-ink">Filter</button>
          </form>
          {loginError && <p role="alert" className="text-sm text-red-700">{loginError}</p>}
          <div className="overflow-x-auto rounded-2xl border border-surface-line bg-white">
            {loginsLoading ? (
              <p role="status" className="p-6 text-sm text-muted">Loading login history…</p>
            ) : (
              <table className="w-full min-w-[700px] text-left text-sm">
                <thead className="bg-surface-soft text-muted">
                  <tr><th className="px-4 py-3">Time</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Action</th><th className="px-4 py-3">IP address</th><th className="px-4 py-3">Actor ID</th><th className="px-4 py-3">Severity</th></tr>
                </thead>
                <tbody>
                  {logins.map((entry) => (
                    <tr key={entry.id} className="border-t border-surface-line">
                      <td className="whitespace-nowrap px-4 py-3">{entry.createdAt ? formatDateTime(entry.createdAt) : '—'}</td>
                      <td className="px-4 py-3 break-all">{entry.email ?? '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${entry.action === 'LOGIN_SUCCESS' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                          {entry.action === 'LOGIN_SUCCESS' ? 'Success' : entry.action === 'LOGIN_FAILED' ? 'Failed' : 'Spike'}
                        </span>
                      </td>
                      <td className="px-4 py-3">{entry.ipAddress ?? '—'}</td>
                      <td className="px-4 py-3">{entry.userId ?? '—'}</td>
                      <td className="px-4 py-3">{severityBadge(entry.severity)}</td>
                    </tr>
                  ))}
                  {logins.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-muted">No login activity recorded yet.</td></tr>}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {tab === 'security' && (
        <>
          {summaryError && <p role="alert" className="text-sm text-red-700">{summaryError}</p>}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {(summaryCards ?? []).map((stat) => (
              <article key={stat.label} className="flex flex-col gap-1 rounded-[24px] border border-surface-line bg-white p-5">
                <p className="text-[13px] leading-[1.21] text-muted">{stat.label}</p>
                <p className={`text-[24px] font-semibold leading-none ${summaryLoading ? 'text-muted' : stat.tone}`}>
                  {summaryLoading ? '…' : stat.value}
                </p>
                <p className="text-xs text-muted">{stat.detail}</p>
              </article>
            ))}
            {!summary && !summaryLoading && !summaryError && (
              <p className="py-12 text-center text-sm text-muted xl:col-span-4">No security data yet.</p>
            )}
          </div>
          <div className="overflow-x-auto rounded-2xl border border-surface-line bg-white">
            {summaryLoading ? (
              <p role="status" className="p-6 text-sm text-muted">Loading warnings…</p>
            ) : (
              <table className="w-full min-w-[700px] text-left text-sm">
                <thead className="bg-surface-soft text-muted">
                  <tr><th className="px-4 py-3">Time</th><th className="px-4 py-3">Severity</th><th className="px-4 py-3">Action</th><th className="px-4 py-3">Entity</th><th className="px-4 py-3">Details</th></tr>
                </thead>
                <tbody>
                  {incidents.map((incident) => (
                    <tr key={incident.id} className="border-t border-surface-line align-top">
                      <td className="whitespace-nowrap px-4 py-3">{incident.createdAt ? formatDateTime(incident.createdAt) : '—'}</td>
                      <td className="px-4 py-3">{severityBadge(incident.severity)}</td>
                      <td className="px-4 py-3">{incident.action}</td>
                      <td className="px-4 py-3">{incident.entityType}{incident.entityId ? ` #${incident.entityId}` : ''}</td>
                      <td className="max-w-md whitespace-pre-wrap break-words px-4 py-3 text-xs">{JSON.stringify(incident.details)}</td>
                    </tr>
                  ))}
                  {incidents.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-muted">No warnings or errors recorded.</td></tr>}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </section>
  );
};

export default AdminLogsPage;
