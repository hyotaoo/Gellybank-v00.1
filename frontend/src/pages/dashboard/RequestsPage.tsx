import { useEffect, useState } from 'react';
import { ApiError } from '@/api/client';
import { cancelRequest, listMyRequests } from '@/api/requests';
import type { RequestStatus, TransactionRequest } from '@/api/requests';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import Button from '@/components/common/Button';
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
  card: 'bg-surface-card text-primary',
  card_lost: 'bg-red-50 text-red-600',
};

const typeLabel: Record<string, string> = {
  deposit: 'Deposit',
  withdrawal: 'Withdrawal',
  card: 'Card',
  card_lost: 'Lost card',
};

const REQUEST_STATUSES: (RequestStatus | undefined)[] = [undefined, 'pending', 'approved', 'rejected', 'cancelled'];

const RequestsPage = () => {
  const [requests, setRequests] = useState<TransactionRequest[]>([]);
  const [filter, setFilter] = useState<RequestStatus | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string>();
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();

  const refresh = async () => {
    setLoading(true);
    setError(undefined);
    try {
      setRequests(await listMyRequests(filter));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to load your requests.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const cancel = async (id: string) => {
    setBusyId(id);
    setError(undefined);
    try {
      await cancelRequest(id);
      setNotice('Request cancelled.');
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to cancel this request.');
    } finally {
      setBusyId(undefined);
    }
  };

  return (
    <DashboardLayout title="My Requests">
      <section className="flex flex-col gap-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-muted">
              Track your deposit and withdrawal requests sent to the teller.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {REQUEST_STATUSES.map((statusOption) => (
              <button
                key={statusOption ?? 'all'}
                type="button"
                onClick={() => setFilter(statusOption)}
                className={`rounded-full px-4 py-2 text-xs font-semibold capitalize transition-colors ${
                  filter === statusOption
                    ? 'bg-primary text-ink'
                    : 'border border-surface-line bg-white text-muted hover:bg-surface-card'
                }`}
              >
                {statusOption ? statusOption : 'All'}
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
            <table className="w-full min-w-[720px] text-left">
              <thead className="bg-surface-soft text-[12px] uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-5 py-3 font-medium">Account</th>
                  <th className="px-5 py-3 font-medium">Type</th>
                  <th className="px-5 py-3 text-right font-medium">Amount</th>
                  <th className="px-5 py-3 font-medium">Note</th>
                  <th className="px-5 py-3 font-medium">Submitted</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-line">
                {requests.map((request) => (
                  <tr key={request.id}>
                    <td className="px-5 py-4 text-sm">
                      <span className="block font-semibold">{request.accountLabel ?? 'Account'}</span>
                      <span className="text-xs text-muted">{request.accountNumber}</span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold capitalize ${typeTone[request.type]}`}>
                        {typeLabel[request.type] ?? request.type}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right text-sm font-semibold">
                      {request.type === 'card' || request.type === 'card_lost' ? '—' : formatCurrency(request.amount, request.currency)}
                    </td>
                    <td className="max-w-[180px] truncate px-5 py-4 text-sm text-muted">{request.note ?? '—'}</td>
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
                    <td className="px-5 py-4 text-right">
                      {request.status === 'pending' && (
                        <Button
                          type="button"
                          variant="secondary"
                          disabled={busyId === request.id}
                          onClick={() => void cancel(request.id)}
                          className="px-4 py-2 text-[13px]"
                        >
                          Cancel
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
                {requests.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-5 py-8 text-center text-sm text-muted">
                      No requests yet. Submit a deposit or withdrawal request to see it here.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </DashboardLayout>
  );
};

export default RequestsPage;
