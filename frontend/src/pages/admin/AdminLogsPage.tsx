import { useEffect, useState } from 'react';
import { ApiError } from '@/api/client';
import { listAuditLogs } from '@/api/admin';
import type { AuditLogEntry, AuditSeverity } from '@/api/admin';

const AdminLogsPage = () => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [severity, setSeverity] = useState<AuditSeverity | ''>('');
  const [actorId, setActorId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  const refresh = async () => {
    setLoading(true);
    setError(undefined);
    try {
      setLogs(await listAuditLogs({ severity: severity || undefined, actorId: actorId.trim() || undefined }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to load audit logs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <section className="flex flex-col gap-6">
      <header>
        <h1 className="text-3xl font-semibold text-primary">Audit and system logs</h1>
        <p className="mt-2 text-sm text-muted">Read-only record of administrative and authentication events.</p>
      </header>
      <form
        className="flex flex-wrap gap-3"
        onSubmit={(event) => { event.preventDefault(); void refresh(); }}
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
        <button type="submit" className="rounded-xl bg-primary px-4 py-2 font-semibold text-ink">Filter</button>
      </form>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <div className="overflow-x-auto rounded-2xl border border-surface-line bg-white">
        {loading ? (
          <p role="status" className="p-6 text-sm text-muted">Loading logs…</p>
        ) : (
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead className="bg-surface-soft text-muted">
              <tr><th className="px-4 py-3">Time</th><th className="px-4 py-3">Severity</th><th className="px-4 py-3">Actor ID</th><th className="px-4 py-3">Action</th><th className="px-4 py-3">Entity</th><th className="px-4 py-3">Details</th></tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-t border-surface-line align-top">
                  <td className="whitespace-nowrap px-4 py-3">{log.createdAt ? new Date(log.createdAt).toLocaleString() : '—'}</td>
                  <td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${log.severity === 'ERROR' ? 'bg-red-100 text-red-700' : log.severity === 'WARN' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-700'}`}>{log.severity}</span></td>
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
    </section>
  );
};

export default AdminLogsPage;
