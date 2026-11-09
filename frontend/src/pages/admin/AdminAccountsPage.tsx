import { useEffect, useState } from 'react';
import { ApiError } from '@/api/client';
import {
  getAdminAccount,
  listAdminAccounts,
  updateAdminAccountStatus,
} from '@/api/admin';
import type {
  AdminAccount,
  AdminAccountAction,
  AdminAccountDetail,
  AdminAccountTransaction,
} from '@/api/admin';
import Button from '@/components/common/Button';
import usePolling from '@/hooks/usePolling';
import { formatCurrency } from '@/utils/format';

const STATUSES = ['all', 'active', 'frozen', 'closed'] as const;

const statusTone: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-700',
  frozen: 'bg-amber-50 text-amber-700',
  closed: 'bg-gray-100 text-gray-600',
};

const transactionTone: Record<string, string> = {
  deposit: 'bg-emerald-50 text-emerald-600',
  withdraw: 'bg-amber-50 text-amber-600',
  transfer: 'bg-sky-50 text-sky-600',
};

const nextActions: Record<string, AdminAccountAction[]> = {
  active: ['freeze', 'close'],
  frozen: ['unfreeze', 'close'],
  closed: ['reopen'],
};

const actionLabel: Record<AdminAccountAction, string> = {
  freeze: 'Freeze',
  unfreeze: 'Unfreeze',
  close: 'Close account',
  reopen: 'Reopen',
};

const actionHint: Record<AdminAccountAction, string> = {
  freeze: 'The customer cannot transact on this account until it is unfrozen.',
  unfreeze: 'The account returns to active and can transact again.',
  close: 'Closing is permanent. The balance must be zero first.',
  reopen: 'Reactivates a closed account.',
};

const actionTone: Record<AdminAccountAction, string> = {
  freeze: 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100',
  unfreeze: 'border-surface-line hover:bg-surface-card',
  close: 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100',
  reopen: 'border-surface-line hover:bg-surface-card',
};

const formatDateTime = (value: string | null) =>
  value ? new Date(value).toLocaleString() : '—';

const AdminAccountsPage = () => {
  const [accounts, setAccounts] = useState<AdminAccount[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<(typeof STATUSES)[number]>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [busyId, setBusyId] = useState<string>();

  const [detail, setDetail] = useState<AdminAccountDetail | null>(null);
  const [detailId, setDetailId] = useState<string>();
  const [detailLoading, setDetailLoading] = useState(false);
  const [confirming, setConfirming] = useState<AdminAccountAction>();
  const [acting, setActing] = useState(false);

  const refresh = async (term: string, silent = false) => {
    if (!silent) setLoading(true);
    setError(undefined);
    try {
      setAccounts(await listAdminAccounts({
        search: term || undefined,
        status: statusFilter === 'all' ? undefined : statusFilter,
      }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to load accounts.');
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void refresh(search); }, [statusFilter]);

  // Keep the account list current without a manual reload.
  usePolling(() => { void refresh(search, true); });

  const openDetail = async (account: AdminAccount) => {
    setError(undefined);
    setDetailId(account.id);
    setConfirming(undefined);
    setDetailLoading(true);
    setDetail(null);
    try {
      const loaded = await getAdminAccount(account.id);
      setDetail(loaded);
      setAccounts((current) => current.map((item) => item.id === loaded.account.id ? loaded.account : item));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to load this account.');
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setDetail(null);
    setConfirming(undefined);
  };

  const applyAction = async (action: AdminAccountAction) => {
    if (!detail) return;
    setActing(true);
    setError(undefined);
    try {
      const updated = await updateAdminAccountStatus(detail.account.id, action);
      setDetail((current) => current && { ...current, account: updated });
      setAccounts((current) => current.map((item) => item.id === updated.id ? updated : item));
      setConfirming(undefined);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to update this account.');
    } finally {
      setActing(false);
      setBusyId(undefined);
    }
  };

  const statusBadge = (status: string) => (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold capitalize ${statusTone[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {status}
    </span>
  );

  const transactionRow = (tx: AdminAccountTransaction) => (
    <div key={tx.id} className="flex items-center gap-3 rounded-xl border border-surface-line px-4 py-3 text-sm">
      <span className={`inline-flex flex-none rounded-full px-3 py-1 text-xs font-semibold capitalize ${transactionTone[tx.type] ?? 'bg-gray-100 text-gray-600'}`}>
        {tx.type === 'withdraw' ? 'Withdrawal' : tx.type}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{formatCurrency(tx.amount, tx.currency)}</p>
        <p className="text-xs text-muted">{tx.reference}</p>
      </div>
      <div className="text-right">
        <p className="text-xs font-semibold text-ink">{tx.status}</p>
        <p className="text-xs text-muted">{formatDateTime(tx.createdAt)}</p>
      </div>
    </div>
  );

  return (
    <section className="flex flex-col gap-6">
      <header>
        <h1 className="text-3xl font-semibold text-primary">Account management</h1>
      </header>

      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void refresh(search);
        }}
      >
        <input
          aria-label="Search accounts"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by account number, name, or email"
          className="min-w-0 flex-1 rounded-xl border border-surface-line bg-white px-4 py-3 outline-none focus:border-primary"
        />
        <button type="submit" className="rounded-xl bg-primary px-5 font-semibold text-ink">Search</button>
      </form>

      <div className="flex flex-wrap gap-2">
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
          <p role="status" className="p-6 text-sm text-muted">Loading accounts…</p>
        ) : (
          <table className="w-full min-w-[780px] text-left text-sm">
            <thead className="bg-surface-soft text-muted">
              <tr>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Account</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3 text-right">Balance</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Opened</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => (
                <tr key={account.id} className="border-t border-surface-line">
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => void openDetail(account)}
                      className="font-medium text-primary text-left hover:underline"
                    >
                      <span className="block">{account.customerName || '—'}</span>
                      <span className="text-xs text-muted">{account.customerEmail}</span>
                    </button>
                  </td>
                  <td className="px-4 py-3 font-medium">{account.accountNumber}</td>
                  <td className="px-4 py-3 capitalize">{account.label ?? account.type}</td>
                  <td className="px-4 py-3 text-right font-semibold">{formatCurrency(account.balance, account.currency)}</td>
                  <td className="px-4 py-3">{statusBadge(account.status)}</td>
                  <td className="px-4 py-3 text-muted">{formatDateTime(account.createdAt)}</td>
                </tr>
              ))}
              {accounts.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted">No accounts match these filters.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {(detailId || detail) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="account-detail-title"
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl"
          >
            {detailId && !detail && (
              <h2 id="account-detail-title" className="text-xl font-semibold">
                {detailLoading ? 'Loading account…' : 'Account details'}
              </h2>
            )}

            {detail && (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 id="account-detail-title" className="text-xl font-semibold">
                      {detail.account.label ?? detail.account.type} account
                    </h2>
                    <p className="mt-0.5 text-sm text-muted">
                      {detail.account.customerName} · {detail.account.accountNumber}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label="Close"
                    onClick={closeDetail}
                    className="rounded-full text-muted transition-colors hover:text-primary"
                  >
                    ✕
                  </button>
                </div>

                <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-muted">Balance</dt>
                    <dd className="font-semibold">{formatCurrency(detail.account.balance, detail.account.currency)}</dd>
                  </div>
                  <div className="flex items-center justify-between sm:justify-start sm:gap-3">
                    <dt className="text-muted">Status</dt>
                    <dd>{statusBadge(detail.account.status)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">Opened</dt>
                    <dd>{formatDateTime(detail.account.createdAt)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">Interest rate</dt>
                    <dd>{detail.account.interestRate}%</dd>
                  </div>
                </dl>

                <div className="mt-4 flex flex-wrap gap-2">
                  {(nextActions[detail.account.status] ?? []).map((action) => (
                    <button
                      key={action}
                      type="button"
                      disabled={busyId === detail.account.id}
                      onClick={() => { setError(undefined); setConfirming(action); }}
                      className={`rounded-xl border px-4 py-2 font-semibold disabled:opacity-50 ${actionTone[action]}`}
                    >
                      {actionLabel[action]}
                    </button>
                  ))}
                </div>

                {detail.recentTransactions.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm font-semibold">Recent transactions</p>
                    <div className="mt-2 flex max-h-56 flex-col gap-2 overflow-y-auto">
                      {detail.recentTransactions.map(transactionRow)}
                    </div>
                  </div>
                )}

                {confirming && (
                  <div
                    role="alertdialog"
                    aria-label={`Confirm ${actionLabel[confirming]}`}
                    className="mt-4 rounded-xl border border-surface-line bg-surface-soft p-4"
                  >
                    <p className="text-sm font-semibold">{actionLabel[confirming]}?</p>
                    <p className="mt-1 text-sm text-muted">{actionHint[confirming]}</p>
                    <div className="mt-3 flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        className="px-4 py-2 text-[13px]"
                        disabled={acting}
                        onClick={() => setConfirming(undefined)}
                      >
                        Cancel
                      </Button>
                      <button
                        type="button"
                        disabled={acting || busyId === detail.account.id}
                        onClick={() => void applyAction(confirming)}
                        className={`rounded-xl border px-4 py-2 font-semibold disabled:opacity-50 ${actionTone[confirming]}`}
                      >
                        {acting ? 'Saving…' : 'Confirm'}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
};

export default AdminAccountsPage;
