import { useEffect, useState } from 'react';
import { ApiError } from '@/api/client';
import {
  approveAdminCardRequest,
  listAdminCardRequests,
  rejectAdminCardRequest,
} from '@/api/admin';
import type { TellerRequest } from '@/api/requests';
import { useToast } from '@/components/common/Toast';
import usePolling from '@/hooks/usePolling';

const AdminCardRequestsPage = () => {
  const [requests, setRequests] = useState<TellerRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string>();
  const [rejecting, setRejecting] = useState<TellerRequest>();
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string>();
  const toast = useToast();

  const refresh = async (silent = false) => {
    if (!silent) setLoading(true);
    setError(undefined);
    try {
      setRequests(await listAdminCardRequests('pending'));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to load lost card reports.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  // Keep the request list current without a manual reload.
  usePolling(() => { void refresh(true); });

  const approve = async (request: TellerRequest) => {
    setBusyId(request.id);
    setError(undefined);
    try {
      await approveAdminCardRequest(request.id);
      toast.success('Replacement card issued to the customer.');
      await refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Unable to approve this request.');
    } finally {
      setBusyId(undefined);
    }
  };

  const reject = async (request: TellerRequest, rejectionReason: string) => {
    setBusyId(request.id);
    setError(undefined);
    try {
      await rejectAdminCardRequest(request.id, rejectionReason);
      toast.success('Lost card report rejected.');
      setRejecting(undefined);
      setReason('');
      await refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Unable to reject this request.');
    } finally {
      setBusyId(undefined);
    }
  };

  return (
    <section className="flex flex-col gap-6">
      <header>
        <h1 className="text-3xl font-semibold text-primary">Lost card requests</h1>
      </header>

      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}

      <div className="overflow-x-auto rounded-2xl border border-surface-line bg-white">
        {loading ? (
          <p role="status" className="p-6 text-sm text-muted">Loading requests…</p>
        ) : (
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-surface-soft text-muted">
              <tr>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Account</th>
                <th className="px-4 py-3">Note</th>
                <th className="px-4 py-3">Submitted</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((request) => (
                <tr key={request.id} className="border-t border-surface-line">
                  <td className="px-4 py-3">
                    <span className="block font-medium">{request.customerName}</span>
                    <span className="text-xs text-muted">{request.customerEmail}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="block">{request.accountLabel ?? 'Account'}</span>
                    <span className="text-xs text-muted">{request.accountNumber}</span>
                  </td>
                  <td className="max-w-[220px] truncate px-4 py-3 text-muted">{request.note ?? '—'}</td>
                  <td className="px-4 py-3 text-muted">
                    {request.createdAt ? new Date(request.createdAt).toLocaleString() : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={busyId === request.id}
                        onClick={() => void approve(request)}
                        className="rounded-lg bg-primary px-3 py-1.5 font-medium text-ink disabled:opacity-50"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        disabled={busyId === request.id}
                        onClick={() => {
                          setRejecting(request);
                          setReason('');
                        }}
                        className="rounded-lg border border-surface-line px-3 py-1.5 disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {requests.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted">
                    There are no pending lost card reports.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {rejecting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form
            role="dialog"
            aria-modal="true"
            aria-labelledby="reject-card-request-title"
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl"
            onSubmit={(event) => {
              event.preventDefault();
              void reject(rejecting, reason);
            }}
          >
            <h2 id="reject-card-request-title" className="text-xl font-semibold">Reject request</h2>
            <p className="mt-2 text-sm text-muted">
              A rejection reason is required and will be recorded in the audit trail.
            </p>
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
              <button
                type="button"
                onClick={() => setRejecting(undefined)}
                className="rounded-xl border border-surface-line px-4 py-2"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busyId === rejecting.id}
                className="rounded-xl bg-primary px-4 py-2 font-semibold disabled:opacity-50"
              >
                Confirm rejection
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
};

export default AdminCardRequestsPage;
