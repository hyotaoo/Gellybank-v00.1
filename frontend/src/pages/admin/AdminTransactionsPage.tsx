import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { ApiError } from '@/api/client';
import {
  getAdminTransaction,
  listAdminTransactions,
  reverseAdminTransaction,
} from '@/api/admin';
import type { AdminTransaction } from '@/api/admin';
import Button from '@/components/common/Button';
import Textarea from '@/components/common/Textarea';
import { useToast } from '@/components/common/Toast';
import usePolling from '@/hooks/usePolling';
import { formatCurrency, formatDateTime as formatDateTimeValue } from '@/utils/format';

const formatDateTime = (value: string | null) => (value ? formatDateTimeValue(value) : '—');

const TYPES = ['all', 'deposit', 'withdrawal', 'transfer', 'adjustment'] as const;
const STATUSES = ['all', 'completed', 'void'] as const;

const statusTone: Record<string, string> = {
  completed: 'bg-emerald-50 text-emerald-700',
  void: 'bg-gray-100 text-gray-500',
};

const typeTone: Record<string, string> = {
  deposit: 'bg-emerald-50 text-emerald-600',
  withdraw: 'bg-amber-50 text-amber-600',
  transfer: 'bg-sky-50 text-sky-600',
  adjustment: 'bg-surface-card text-primary',
};

const typeLabel = (type: string) =>
  type === 'withdraw' ? 'Withdrawal' : type.charAt(0).toUpperCase() + type.slice(1);

const AdminTransactionsPage = () => {
  const [transactions, setTransactions] = useState<AdminTransaction[]>([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<(typeof TYPES)[number]>('all');
  const [statusFilter, setStatusFilter] = useState<(typeof STATUSES)[number]>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const toast = useToast();

  const [detail, setDetail] = useState<AdminTransaction>();
  const [detailLoading, setDetailLoading] = useState(false);
  const [reversing, setReversing] = useState(false);
  const [reason, setReason] = useState('');

  const refresh = async (silent = false) => {
    if (!silent) setLoading(true);
    setError(undefined);
    try {
      setTransactions(await listAdminTransactions({
        search: search || undefined,
        type: typeFilter === 'all' ? undefined : typeFilter,
        status: statusFilter === 'all' ? undefined : statusFilter,
        from: from || undefined,
        to: to || undefined,
        limit: 100,
      }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to load transactions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeFilter, statusFilter]);

  // Keep the list current without a manual reload.
  usePolling(() => { void refresh(true); });

  const openDetail = async (tx: Pick<AdminTransaction, 'id'>) => {
    setError(undefined);
    setDetailLoading(true);
    setDetail(undefined);
    try {
      setDetail(await getAdminTransaction(tx.id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to load this transaction.');
    } finally {
      setDetailLoading(false);
    }
  };

  const submitReversal = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!detail) return;
    setReversing(true);
    setError(undefined);
    try {
      const reversed = await reverseAdminTransaction(detail.id, reason.trim());
      toast.success(`Transaction ${reversed.reference} was reversed.`);
      setReversing(false);
      setReason('');
      await refresh();
      setDetail(reversed);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Unable to reverse this transaction.');
    } finally {
      setReversing(false);
    }
  };

  const statusBadge = (status: string) => (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold capitalize ${statusTone[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {status}
    </span>
  );

  const typeBadge = (type: string) => (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${typeTone[type] ?? 'bg-gray-100 text-gray-600'}`}>
      {typeLabel(type)}
    </span>
  );

  return (
    <section className="flex flex-col gap-6">
      <header>
        <h1 className="text-3xl font-semibold text-primary">Transaction management</h1>
      </header>

      <form
        className="flex flex-wrap gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void refresh();
        }}
      >
        <input
          aria-label="Search transactions"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by reference, customer, or account"
          className="min-w-[220px] flex-1 rounded-xl border border-surface-line bg-white px-4 py-3 outline-none focus:border-primary"
        />
        <label className="flex items-center gap-2 text-sm text-muted">
          From
          <input
            type="date"
            aria-label="From date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
            className="rounded-xl border border-surface-line bg-white px-3 py-2"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-muted">
          To
          <input
            type="date"
            aria-label="To date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
            className="rounded-xl border border-surface-line bg-white px-3 py-2"
          />
        </label>
        <button type="submit" className="rounded-xl bg-primary px-5 font-semibold text-ink">Filter</button>
      </form>

      <div className="flex flex-wrap gap-2">
        {TYPES.map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => setTypeFilter(type)}
            className={`rounded-full px-4 py-2 text-xs font-semibold capitalize transition-colors ${
              typeFilter === type
                ? 'bg-primary text-ink'
                : 'border border-surface-line bg-white text-muted hover:bg-surface-card'
            }`}
          >
            {type === 'all' ? 'All types' : type}
          </button>
        ))}
        <span className="mx-1 hidden w-px self-stretch bg-surface-line sm:block" />
        {STATUSES.map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setStatusFilter(status)}
            className={`rounded-full px-4 py-2 text-xs font-semibold capitalize transition-colors ${
              statusFilter === status
                ? 'bg-primary text-ink'
                : 'border border-surface-line bg-white text-muted hover:bg-surface-card'
            }`}
          >
            {status === 'all' ? 'All statuses' : status}
          </button>
        ))}
      </div>

      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}

      <div className="overflow-x-auto rounded-2xl border border-surface-line bg-white">
        {loading ? (
          <p role="status" className="p-6 text-sm text-muted">Loading transactions…</p>
        ) : (
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="bg-surface-soft text-muted">
              <tr>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3">Account</th>
                <th className="px-4 py-3">Reference</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => (
                <tr key={tx.id} className="border-t border-surface-line">
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => void openDetail(tx)}
                      className="font-medium text-primary text-left hover:underline"
                    >
                      <span className="block">{tx.customerName ?? '—'}</span>
                      <span className="text-xs text-muted">{tx.customerEmail}</span>
                    </button>
                  </td>
                  <td className="px-4 py-3">{typeBadge(tx.type)}</td>
                  <td className="px-4 py-3 text-right font-semibold">{formatCurrency(tx.amount, tx.currency)}</td>
                  <td className="px-4 py-3">{tx.accountNumber ?? '—'}</td>
                  <td className="px-4 py-3 font-mono text-xs">{tx.reference}</td>
                  <td className="px-4 py-3 text-muted">{formatDateTime(tx.createdAt)}</td>
                  <td className="px-4 py-3">{statusBadge(tx.status)}</td>
                </tr>
              ))}
              {transactions.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-muted">No transactions match these filters.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {(detail || detailLoading) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="transaction-detail-title"
            className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
          >
            {detailLoading || !detail ? (
              <h2 id="transaction-detail-title" className="text-xl font-semibold">Loading transaction…</h2>
            ) : (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 id="transaction-detail-title" className="text-xl font-semibold">Transaction details</h2>
                    <p className="mt-0.5 font-mono text-xs text-muted">{detail.reference}</p>
                  </div>
                  <button
                    type="button"
                    aria-label="Close"
                    onClick={() => setDetail(undefined)}
                    className="rounded-full text-muted transition-colors hover:text-primary"
                  >
                    ✕
                  </button>
                </div>

                <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                  <div><dt className="text-muted">Type</dt><dd>{typeBadge(detail.type)}</dd></div>
                  <div><dt className="text-muted">Amount</dt><dd className="font-semibold">{formatCurrency(detail.amount, detail.currency)}</dd></div>
                  <div><dt className="text-muted">Balance after</dt><dd>{formatCurrency(detail.balanceAfter, detail.currency)}</dd></div>
                  <div><dt className="text-muted">Status</dt><dd>{statusBadge(detail.status)}</dd></div>
                  <div><dt className="text-muted">Customer</dt><dd>{detail.customerName ?? '—'}</dd></div>
                  <div><dt className="text-muted">Account</dt><dd>{detail.account?.accountNumber ?? detail.accountNumber ?? '—'}</dd></div>
                  <div><dt className="text-muted">Performed by</dt><dd className="capitalize">{detail.performedBy ?? 'Customer/self-service'}</dd></div>
                  <div><dt className="text-muted">Date</dt><dd>{formatDateTime(detail.createdAt)}</dd></div>
                  <div><dt className="text-muted">Counterparty</dt><dd>{detail.counterparty ?? '—'}</dd></div>
                  <div><dt className="text-muted">Note</dt><dd>{detail.note ?? '—'}</dd></div>
                </dl>

                {detail.status !== 'void' && detail.type !== 'adjustment' && (
                  <form
                    className="mt-5 rounded-xl border border-surface-line bg-surface-soft p-4"
                    onSubmit={submitReversal}
                  >
                    <p className="text-sm font-semibold">Reverse transaction</p>
                    <p className="mt-1 text-sm text-muted">
                      Creates a compensating adjustment and voids the original. The action is recorded in the audit trail.
                    </p>
                    <label className="mt-3 block text-sm font-medium">
                      Reversal reason
                      <Textarea
                        required
                        autoFocus
                        maxLength={500}
                        value={reason}
                        onChange={(event) => setReason(event.target.value)}
                        className="mt-2"
                      />
                    </label>
                    <div className="mt-3 flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        className="px-4 py-2 text-[13px]"
                        disabled={reversing}
                        onClick={() => { setReason(''); }}
                      >
                        Clear
                      </Button>
                      <button
                        type="submit"
                        disabled={reversing || !reason.trim()}
                        className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
                      >
                        {reversing ? 'Reversing…' : 'Confirm reversal'}
                      </button>
                    </div>
                  </form>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
};

export default AdminTransactionsPage;
