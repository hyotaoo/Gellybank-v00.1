import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listMyRequests } from '@/api/requests';
import type { TransactionRequest } from '@/api/requests';
import usePolling from '@/hooks/usePolling';
import ChevronRightIcon from '@/components/icons/ChevronRightIcon';
import { formatCurrency } from '@/utils/format';

const statusTone: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700',
  approved: 'bg-emerald-50 text-emerald-700',
  rejected: 'bg-red-50 text-red-700',
  cancelled: 'bg-gray-100 text-gray-600',
};

const typeLabel: Record<string, string> = {
  deposit: 'Deposit',
  withdrawal: 'Withdrawal',
  card: 'New card',
  card_lost: 'Lost card',
};

const RequestsSummaryCard = () => {
  const [requests, setRequests] = useState<TransactionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  useEffect(() => {
    const controller = new AbortController();

    listMyRequests(undefined, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setRequests(data);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setError((err as Error).message || 'Unable to load your requests.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, []);

  // Keep the summary current without a manual reload.
  usePolling(() => {
    listMyRequests()
      .then((data) => {
        setRequests(data);
        setError(undefined);
      })
      .catch(() => {
        // Keep showing the last known requests on a failed poll.
      });
  });

  return (
    <section className="flex h-[500px] flex-1 flex-col gap-6 overflow-hidden rounded-[36px] border border-surface-line bg-surface-soft p-8">
      <header className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-[20px] font-normal leading-[1.21] text-ink">Requests</h2>
          <Link
            to="/dashboard/requests"
            aria-label="View all requests"
            className="flex h-5 w-5 items-center justify-center text-ink transition-opacity hover:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-hover"
          >
            <ChevronRightIcon className="h-[18px] w-[18px]" />
          </Link>
        </div>
        <span className="block h-px w-full bg-ink/10" />
      </header>

      {loading ? (
        <p role="status" className="text-[14px] text-muted">Loading requests…</p>
      ) : error ? (
        <p role="alert" className="text-[14px] text-red-600">{error}</p>
      ) : requests.length === 0 ? (
        <p className="text-[14px] text-muted">
          No requests yet. Submit a deposit or withdrawal request to see it here.
        </p>
      ) : (
        <ul className="flex flex-col gap-3 overflow-y-auto">
          {requests.slice(0, 5).map((request) => (
            <li
              key={request.id}
              className="flex items-center justify-between gap-3 rounded-[20px] bg-white p-3"
            >
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-[14px] font-semibold leading-[1.21] text-ink">
                  {typeLabel[request.type] ?? request.type}
                </span>
                <span className="truncate text-[13px] leading-[1.21] text-muted">
                  {request.createdAt
                    ? new Date(request.createdAt).toLocaleDateString()
                    : request.accountNumber ?? '—'}
                </span>
              </div>

              <div className="flex flex-none flex-col items-end gap-1">
                <span className="text-[14px] font-semibold leading-[1.21] text-ink">
                  {request.type === 'card' || request.type === 'card_lost'
                    ? '—'
                    : formatCurrency(request.amount, request.currency)}
                </span>
                <span
                  className={`inline-flex rounded-full px-2.5 py-0.5 text-[12px] font-semibold capitalize ${statusTone[request.status]}`}
                >
                  {request.status}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

export default RequestsSummaryCard;
