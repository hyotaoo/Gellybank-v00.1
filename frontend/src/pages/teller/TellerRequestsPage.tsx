import { useEffect, useState } from 'react';
import { ApiError } from '@/api/client';
import { approveTellerRequest, rejectTellerRequest, listTellerRequests } from '@/api/requests';
import type { TellerRequest } from '@/api/requests';
import { formatCurrency } from '@/utils/format';

const statusTone: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700',
  approved: 'bg-emerald-50 text-emerald-700',
  rejected: 'bg-red-50 text-red-700',
  cancelled: 'bg-gray-100 text-gray-600',
};

const typeTone: Record<string, string> = {
  deposit: 'bg-emerald-50 text-emerald-600',
  withdrawal: 'bg-amber-50 text-amber-600',
};

const STATUSES = ['pending', 'approved', 'rejected', 'cancelled'] as const;

const TellerRequestsPage = () => {
  const [requests, setRequests] = useState<TellerRequest[]>([]);
  const [filter, setFilter] = useState<(typeof STATUSES)[number]>('pending');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string>();
  const [rejecting, setRejecting] = useState<TellerRequest>();
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();

  const refresh = async () => {
    setLoading(true);
    setError(undefined);
    try {
      setRequests(await listTellerRequests(filter));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to load requests.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const approve = async (request: TellerRequest) => {
    setBusyId(request.id);
    setError(undefined);
    setNotice(undefined);
    try {
      const result = await approveTellerRequest(request.id);
      setNotice(
        `${result.type === 'withdrawal' ? 'Withdrawal' : 'Deposit'} of ${formatCurrency(result.amount)} processed successfully.`,
      );
      setRejecting(undefined);
      setReason('');
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to process this request.');
    } finally {
      setBusyId(undefined);
    }
  };

  const reject = async (request: TellerRequest, rejectionReason: string) => {
    setBusyId(request.id);
    setError(undefined);
    setNotice(undefined);
    try {
      await rejectTellerRequest(request.id, rejectionReason);
      setNotice('Request rejected.');
      setRejecting(undefined);
      setReason('');
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to reject this request.');
    } finally {
      setBusyId(undefined);
    }
  };

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[30px] font-semibold leading-none text-primary sm:text-[36px]">
            Customer Requests
          </h1>
          <p className="mt-2 text-sm text-muted">
            Review, approve, or reject customer deposit and withdrawal requests.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {STATUSES.map((statusOption) => (
            <button
              key={statusOption}
              type="button"
              onClick={() => setFilter(statusOption)}
              className={`rounded-full px-4 py-2 text-xs font-semibold capitalize transition-colors ${
                filter === statusOption
                  ? 'bg-primary text-ink'
                  : 'border border-surface-line bg-white text-muted hover:bg-surface-card'
              }`}
            >
              {statusOption}
            </button>
          ))}
        </div>
      </header>

      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {notice && <p role="status" className="text-sm text-emerald-700">{notice}</p>}

      <div className="overflow-x-auto rounded-[24px] border border-surface-line bg-white">
        {loading ? (
          <p role="status" className="p-6 text-sm text-muted">Loading requests…</p>
        ) : (
          <table className="w-full min-w-[820px] text-left">
            <thead className="bg-surface-soft text-[12px] uppercase tracking-wide text-muted">
              <tr>
                <th className="px-5 py-3 font-medium">Customer</th>
                <th className="px-5 py-3 font-medium">Account</th>
                <th className="px-5 py-3 font-medium">Type</th>
                <th className="px-5 py-3 text-right font-medium">Amount</th>
                <th className="px-5 py-3 font-medium">Note</th>
                <th className="px-5 py-3 font-medium">Submitted</th>
                <th className="px-5 py-3 font-medium">Status</th>
                {filter === 'pending' && <th className="px-5 py-3 text-right font-medium">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-line">
              {requests.map((request) => (
                <tr key={request.id}>
                  <td className="px-5 py-4 text-sm">
                    <span className="block font-semibold">{request.customerName}</span>
                    <span className="text-xs text-muted">{request.customerEmail}</span>
                  </td>
                  <td className="px-5 py-4 text-sm">
                    <span className="block font-medium">{request.accountLabel ?? 'Account'}</span>
                    <span className="text-xs text-muted">{request.accountNumber}</span>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold capitalize ${typeTone[request.type]}`}>
                      {request.type}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right text-sm font-semibold">
                    {formatCurrency(request.amount, request.currency)}
                  </td>
                  <td className="max-w-[160px] truncate px-5 py-4 text-sm text-muted">{request.note ?? '—'}</td>
                  <td className="px-5 py-4 text-sm text-muted">
                    {request.createdAt ? new Date(request.createdAt).toLocaleString() : '—'}
                  </td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold capitalize ${statusTone[request.status]}`}>
                      {request.status}
                    </span>
                    {request.status === 'rejected' && request.rejectionReason && (
                      <span className="mt-1 block text-xs text-red-700">Reason: {request.rejectionReason}</span>
                    )}
                  </td>
                  {filter === 'pending' && (
                    <td className="px-5 py-4 text-right">
                      <div className="flex justify-end gap-2">
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
                          onClick={() => { setRejecting(request); setReason(''); }}
                          className="rounded-lg border border-surface-line px-3 py-1.5 font-medium disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {requests.length === 0 && (
                <tr>
                  <td colSpan={filter === 'pending' ? 8 : 7} className="px-5 py-8 text-center text-sm text-muted">
                    No {filter} requests.
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
            aria-labelledby="reject-request-title"
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl"
            onSubmit={(event) => {
              event.preventDefault();
              if (rejecting) void reject(rejecting, reason);
            }}
          >
            <h2 id="reject-request-title" className="text-xl font-semibold">Reject request</h2>
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
              <button type="button" onClick={() => setRejecting(undefined)} className="rounded-xl border border-surface-line px-4 py-2">
                Cancel
              </button>
              <button type="submit" disabled={busyId === rejecting.id} className="rounded-xl bg-primary px-4 py-2 font-semibold disabled:opacity-50">
                Confirm rejection
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
};

export default TellerRequestsPage;
