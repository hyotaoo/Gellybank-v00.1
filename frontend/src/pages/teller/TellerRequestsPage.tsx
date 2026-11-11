import { useEffect, useRef, useState } from 'react';
import { ApiError } from '@/api/client';
import { approveTellerRequest, rejectTellerRequest, listTellerRequests } from '@/api/requests';
import type { TellerRequest } from '@/api/requests';
import { getTellerAccount } from '@/api/teller';
import type { TellerCustomer } from '@/api/teller';
import type { Account } from '@/api/accounts';
import type { Transaction } from '@/api/transactions';
import usePolling from '@/hooks/usePolling';
import { formatAccountNumber, formatCurrency, formatDateTime } from '@/utils/format';
import ReceiptModal from '@/components/dashboard/ReceiptModal';
import TellerHeader from '@/components/teller/TellerHeader';
import { useToast } from '@/components/common/Toast';

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
};

const STATUSES = ['pending', 'approved', 'rejected', 'cancelled'] as const;
const TYPES = ['all', 'deposit', 'withdrawal', 'card'] as const;

const TellerRequestsPage = () => {
  const [requests, setRequests] = useState<TellerRequest[]>([]);
  const [filter, setFilter] = useState<(typeof STATUSES)[number]>('pending');
  const [typeFilter, setTypeFilter] = useState<(typeof TYPES)[number]>('all');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string>();
  const [rejecting, setRejecting] = useState<TellerRequest>();
  const [reason, setReason] = useState('');
  const [viewing, setViewing] = useState<TellerRequest>();
  const [verification, setVerification] = useState<TellerCustomer>();
  const [verifying, setVerifying] = useState(false);
  const [receipt, setReceipt] = useState<{ transaction: Transaction; account?: Account }>();
  const detailIdRef = useRef<string>();
  const [error, setError] = useState<string>();
  const toast = useToast();

  const refresh = async (silent = false) => {
    if (!silent) setLoading(true);
    setError(undefined);
    try {
      setRequests(await listTellerRequests({
        status: filter,
        type: typeFilter === 'all' ? undefined : typeFilter,
        search,
        from: dateFrom || undefined,
        to: dateTo || undefined,
      }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to load requests.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, typeFilter, search, dateFrom, dateTo]);

  // Keep the queue current without a manual reload.
  usePolling(() => { void refresh(true); });

  const approve = async (request: TellerRequest) => {
    setBusyId(request.id);
    setError(undefined);
    try {
      const result = await approveTellerRequest(request.id);
      if (result.type === 'card') {
        toast.success('Card request approved. A new card was issued to the customer.');
      } else {
        toast.success(
          `${result.type === 'withdrawal' ? 'Withdrawal' : 'Deposit'} of ${formatCurrency(result.amount)} processed successfully.`,
        );
        if (result.transaction) {
          setReceipt({ transaction: result.transaction, account: result.account });
        }
      }
      setRejecting(undefined);
      setReason('');
      await refresh();
      return true;
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Unable to process this request.');
      return false;
    } finally {
      setBusyId(undefined);
    }
  };

  const reject = async (request: TellerRequest, rejectionReason: string) => {
    setBusyId(request.id);
    setError(undefined);
    try {
      await rejectTellerRequest(request.id, rejectionReason);
      toast.success('Request rejected.');
      setRejecting(undefined);
      setReason('');
      await refresh();
      return true;
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Unable to reject this request.');
      return false;
    } finally {
      setBusyId(undefined);
    }
  };

  const openDetail = async (request: TellerRequest) => {
    detailIdRef.current = request.id;
    setViewing(request);
    setVerification(undefined);
    setVerifying(true);
    try {
      const data = await getTellerAccount(request.accountId);
      if (detailIdRef.current === request.id) setVerification(data);
    } catch (err) {
      if (detailIdRef.current === request.id) {
        toast.error(
          err instanceof ApiError ? err.message : 'Unable to verify this customer and account.',
        );
      }
    } finally {
      if (detailIdRef.current === request.id) setVerifying(false);
    }
  };

  const approveFromDetail = async (request: TellerRequest) => {
    if (await approve(request)) setViewing(undefined);
  };

  return (
    <section className="flex flex-col gap-6">
      <TellerHeader
        title="Customer Requests"
        actions={
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
        }
      />

      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}

      <div className="flex flex-wrap items-end gap-3 rounded-[24px] border border-surface-line bg-white p-4">
        <label className="flex min-w-[220px] flex-1 flex-col gap-1 text-xs font-medium text-muted">
          Search
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Customer name, account number, or reference"
            className="h-[43px] rounded-xl border border-surface-line bg-white px-4 text-sm text-ink outline-none focus:border-primary"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted">
          Type
          <select
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value as (typeof TYPES)[number])}
            className="h-[43px] rounded-xl border border-surface-line bg-white px-3 text-sm capitalize text-ink outline-none focus:border-primary"
          >
            {TYPES.map((typeOption) => (
              <option key={typeOption} value={typeOption}>
                {typeOption === 'all' ? 'All types' : typeOption}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted">
          From
          <input
            type="date"
            value={dateFrom}
            onChange={(event) => setDateFrom(event.target.value)}
            className="h-[43px] rounded-xl border border-surface-line bg-white px-3 text-sm text-ink outline-none focus:border-primary"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted">
          To
          <input
            type="date"
            value={dateTo}
            onChange={(event) => setDateTo(event.target.value)}
            className="h-[43px] rounded-xl border border-surface-line bg-white px-3 text-sm text-ink outline-none focus:border-primary"
          />
        </label>
        {(search || typeFilter !== 'all' || dateFrom || dateTo) && (
          <button
            type="button"
            onClick={() => {
              setSearch('');
              setTypeFilter('all');
              setDateFrom('');
              setDateTo('');
            }}
            className="h-[43px] rounded-xl border border-surface-line px-4 text-sm font-medium hover:bg-surface-card"
          >
            Clear filters
          </button>
        )}
      </div>

      <div className="overflow-x-auto rounded-[24px] border border-surface-line bg-white">
        {loading ? (
          <p role="status" className="p-6 text-sm text-muted">Loading requests…</p>
        ) : (
          <table className="w-full min-w-[1000px] text-left">
            <thead className="bg-surface-soft text-[12px] uppercase tracking-wide text-muted">
              <tr>
                <th className="px-5 py-3 font-medium">Customer</th>
                <th className="px-5 py-3 font-medium">Reference</th>
                <th className="px-5 py-3 font-medium">Account</th>
                <th className="px-5 py-3 font-medium">Type</th>
                <th className="px-5 py-3 text-right font-medium">Amount</th>
                <th className="px-5 py-3 font-medium">Note</th>
                <th className="px-5 py-3 font-medium">Submitted</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 text-right font-medium">Details</th>
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
                  <td className="px-5 py-4 font-mono text-xs">{request.reference}</td>
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
                    {request.type === 'card' ? '—' : formatCurrency(request.amount, request.currency)}
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
                  <td className="px-5 py-4 text-right">
                    <button
                      type="button"
                      onClick={() => void openDetail(request)}
                      className="rounded-lg border border-surface-line px-3 py-1.5 font-medium hover:bg-surface-card"
                    >
                      View
                    </button>
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
                  <td colSpan={filter === 'pending' ? 10 : 9} className="px-5 py-8 text-center text-sm text-muted">
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
      {viewing && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setViewing(undefined);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="request-detail-title"
            className="max-h-[92dvh] w-full max-w-3xl overflow-y-auto rounded-t-2xl bg-white p-6 shadow-xl sm:rounded-2xl"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 id="request-detail-title" className="text-xl font-semibold">
                  Request {viewing.reference}
                </h2>
                <p className="mt-1 text-sm text-muted">
                  Full request details and customer/account verification.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold capitalize ${statusTone[viewing.status]}`}>
                  {viewing.status}
                </span>
                <button
                  type="button"
                  aria-label="Close request details"
                  onClick={() => setViewing(undefined)}
                  className="rounded-lg border border-surface-line px-3 py-1.5 text-sm font-medium hover:bg-surface-card"
                >
                  Close
                </button>
              </div>
            </div>

            <dl className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs text-muted">Customer</dt>
                <dd className="text-sm font-semibold">{viewing.customerName}</dd>
                <dd className="text-xs text-muted">{viewing.customerEmail}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Account</dt>
                <dd className="text-sm font-semibold">{viewing.accountLabel ?? 'Account'}</dd>
                <dd className="font-mono text-xs text-muted">
                  {viewing.accountNumber ? formatAccountNumber(viewing.accountNumber) : '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Reference</dt>
                <dd className="font-mono text-xs">{viewing.reference}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Type</dt>
                <dd className="mt-1">
                  <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold capitalize ${typeTone[viewing.type]}`}>
                    {viewing.type}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Amount</dt>
                <dd className="text-sm font-semibold">
                  {viewing.type === 'card' ? '—' : formatCurrency(viewing.amount, viewing.currency)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Submitted</dt>
                <dd className="text-sm">{viewing.createdAt ? formatDateTime(viewing.createdAt) : '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Reviewed</dt>
                <dd className="text-sm">
                  {viewing.reviewedAt ? formatDateTime(viewing.reviewedAt) : '—'}
                  {viewing.reviewedByRole ? ` · ${viewing.reviewedByRole}` : ''}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Transaction</dt>
                <dd className="font-mono text-xs">{viewing.transactionId ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Note</dt>
                <dd className="text-sm">{viewing.note ?? '—'}</dd>
              </div>
              {viewing.rejectionReason && (
                <div className="sm:col-span-2">
                  <dt className="text-xs text-muted">Rejection reason</dt>
                  <dd className="text-sm text-red-700">{viewing.rejectionReason}</dd>
                </div>
              )}
            </dl>

            <div className="mt-6 rounded-xl border border-surface-line bg-surface-soft p-4">
              <h3 className="text-sm font-semibold">Verification</h3>
              {verifying ? (
                <p role="status" className="mt-2 text-sm text-muted">Verifying customer and account…</p>
              ) : verification ? (
                <div className="mt-2 grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <span className="text-xs text-muted">Customer</span>
                    <p className="font-semibold">{verification.name}</p>
                    <p className="text-xs text-muted">{verification.phone ?? 'No phone on file'}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted">Account status</span>
                    <p className="font-semibold capitalize">
                      {verification.accounts.find((item) => item.id === viewing.accountId)?.status ?? 'Not found'}
                    </p>
                    <p className="text-xs text-muted">
                      Balance:{' '}
                      {(() => {
                        const item = verification.accounts.find((account) => account.id === viewing.accountId);
                        return item ? formatCurrency(item.balance, item.currency) : '—';
                      })()}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-sm text-muted">No verification data available.</p>
              )}
            </div>

            {viewing.status === 'pending' && (
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setRejecting(viewing);
                    setReason('');
                    setViewing(undefined);
                  }}
                  className="rounded-xl border border-surface-line px-4 py-2 font-medium"
                >
                  Reject
                </button>
                <button
                  type="button"
                  disabled={busyId === viewing.id}
                  onClick={() => void approveFromDetail(viewing)}
                  className="rounded-xl bg-primary px-4 py-2 font-semibold text-ink disabled:opacity-50"
                >
                  {busyId === viewing.id ? 'Processing…' : 'Approve request'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {receipt && (
        <ReceiptModal
          transaction={receipt.transaction}
          account={receipt.account}
          onClose={() => setReceipt(undefined)}
        />
      )}
    </section>
  );
};

export default TellerRequestsPage;
