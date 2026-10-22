import { useEffect, useState } from 'react';
import { ApiError } from '@/api/client';
import { decideAccountApplication, listAccountApplications } from '@/api/admin';
import type { AccountApplication } from '@/api/admin';
import { formatCurrency } from '@/utils/format';

const AdminApplicationsPage = () => {
  const [applications, setApplications] = useState<AccountApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string>();
  const [rejecting, setRejecting] = useState<AccountApplication>();
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();

  const refresh = async () => {
    setLoading(true);
    setError(undefined);
    try {
      setApplications(await listAccountApplications('pending'));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to load account applications.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const decide = async (application: AccountApplication, decision: 'approve' | 'reject', rejectionReason?: string) => {
    setBusyId(application.id);
    setError(undefined);
    try {
      const result = await decideAccountApplication(application.id, decision, rejectionReason);
      setNotice(
        decision === 'approve' && result.accountNumber
          ? `Application approved. Account ${result.accountNumber} was created.`
          : 'Application rejected.',
      );
      setRejecting(undefined);
      setReason('');
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to process this application.');
    } finally {
      setBusyId(undefined);
    }
  };

  return (
    <section className="flex flex-col gap-6">
      <header>
        <h1 className="text-3xl font-semibold text-primary">Account applications</h1>
        <p className="mt-2 text-sm text-muted">Approve or reject pending Checking and Savings account applications.</p>
      </header>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {notice && <p role="status" className="text-sm text-emerald-700">{notice}</p>}
      <div className="overflow-x-auto rounded-2xl border border-surface-line bg-white">
        {loading ? (
          <p role="status" className="p-6 text-sm text-muted">Loading applications…</p>
        ) : (
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-surface-soft text-muted">
              <tr><th className="px-4 py-3">Applicant</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Initial deposit</th><th className="px-4 py-3">Submitted</th><th className="px-4 py-3">Actions</th></tr>
            </thead>
            <tbody>
              {applications.map((application) => (
                <tr key={application.id} className="border-t border-surface-line">
                  <td className="px-4 py-3"><span className="block font-medium">{application.customerName}</span><span className="text-xs text-muted">{application.customerEmail}</span></td>
                  <td className="px-4 py-3 capitalize">{application.accountType}</td>
                  <td className="px-4 py-3">{formatCurrency(application.initialDeposit)}</td>
                  <td className="px-4 py-3">{application.createdAt ? new Date(application.createdAt).toLocaleString() : '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={busyId === application.id}
                        onClick={() => void decide(application, 'approve')}
                        className="rounded-lg bg-primary px-3 py-1.5 font-medium text-ink disabled:opacity-50"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        disabled={busyId === application.id}
                        onClick={() => { setRejecting(application); setReason(''); }}
                        className="rounded-lg border border-surface-line px-3 py-1.5 disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {applications.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-muted">There are no pending applications.</td></tr>}
            </tbody>
          </table>
        )}
      </div>

      {rejecting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form
            role="dialog"
            aria-modal="true"
            aria-labelledby="reject-application-title"
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl"
            onSubmit={(event) => {
              event.preventDefault();
              void decide(rejecting, 'reject', reason);
            }}
          >
            <h2 id="reject-application-title" className="text-xl font-semibold">Reject application</h2>
            <p className="mt-2 text-sm text-muted">A rejection reason is required and will be retained in the audit trail.</p>
            <label className="mt-4 block text-sm font-medium">
              Rejection reason
              <textarea
                autoFocus
                required
                maxLength={500}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                className="mt-2 min-h-28 w-full rounded-xl border border-surface-line p-3 outline-none focus:border-primary"
              />
            </label>
            <div className="mt-5 flex justify-end gap-3">
              <button type="button" onClick={() => setRejecting(undefined)} className="rounded-xl border border-surface-line px-4 py-2">Cancel</button>
              <button type="submit" disabled={busyId === rejecting.id} className="rounded-xl bg-primary px-4 py-2 font-semibold disabled:opacity-50">Confirm rejection</button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
};

export default AdminApplicationsPage;
