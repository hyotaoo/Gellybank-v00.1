import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiError } from '@/api/client';
import { listTellerRequests } from '@/api/requests';
import type { TellerRequest } from '@/api/requests';
import { listTellerTransactions } from '@/api/teller';
import type { TellerTransactionsResponse } from '@/api/teller';
import usePolling from '@/hooks/usePolling';
import { formatCurrency, formatDateTime } from '@/utils/format';
import DepositIcon from '@/components/icons/DepositIcon';
import HistoryIcon from '@/components/icons/HistoryIcon';
import TransferIcon from '@/components/icons/TransferIcon';
import WithdrawIcon from '@/components/icons/WithdrawIcon';
import TellerHeader from '@/components/teller/TellerHeader';

const typeTone: Record<string, string> = {
  deposit: 'bg-emerald-50 text-emerald-600',
  withdraw: 'bg-amber-50 text-amber-600',
  transfer: 'bg-surface-card text-primary',
};

const todayKey = () => new Date().toISOString().slice(0, 10);

const TellerDashboardPage = () => {
  const [requests, setRequests] = useState<TellerRequest[]>([]);
  const [recent, setRecent] = useState<TellerTransactionsResponse>();
  const [today, setToday] = useState<TellerTransactionsResponse>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  const refresh = async (silent = false) => {
    if (!silent) setLoading(true);
    setError(undefined);
    try {
      const date = todayKey();
      const [pending, recentTransactions, todayTransactions] = await Promise.all([
        listTellerRequests({ status: 'pending' }),
        listTellerTransactions({ limit: 8 }),
        listTellerTransactions({ from: date, to: date, limit: 1 }),
      ]);
      setRequests(pending);
      setRecent(recentTransactions);
      setToday(todayTransactions);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to load the dashboard.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  // Keep the queue and totals current without a manual reload.
  usePolling(() => { void refresh(true); });

  const currency = today?.currency ?? 'PHP';
  const summary = today?.summary;
  const transactionsToday =
    (summary?.deposits.count ?? 0) +
    (summary?.withdrawals.count ?? 0) +
    (summary?.other.count ?? 0);

  const stats = [
    { label: 'Pending requests', value: String(requests.length), icon: <TransferIcon className="h-5 w-5" />, tone: 'bg-surface-card text-primary' },
    { label: 'Deposits today', value: formatCurrency(summary?.deposits.total ?? 0, currency), icon: <DepositIcon className="h-5 w-5" />, tone: 'bg-emerald-50 text-emerald-600' },
    { label: 'Withdrawals today', value: formatCurrency(summary?.withdrawals.total ?? 0, currency), icon: <WithdrawIcon className="h-5 w-5" />, tone: 'bg-amber-50 text-amber-600' },
    { label: 'Transactions processed today', value: String(transactionsToday), icon: <HistoryIcon className="h-5 w-5" />, tone: 'bg-sky-50 text-sky-600' },
  ];

  return (
    <section className="flex flex-col gap-6">
      <TellerHeader
        title="Teller Dashboard"
        actions={
          <span className="rounded-full border border-surface-line bg-white px-4 py-2 text-xs font-medium text-muted">
            Today
          </span>
        }
      />

      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <article
            key={stat.label}
            className="flex items-center gap-4 rounded-[24px] border border-surface-line bg-white p-5"
          >
            <span className={`flex h-11 w-11 flex-none items-center justify-center rounded-[14px] ${stat.tone}`}>
              {stat.icon}
            </span>
            <div className="min-w-0">
              <p className="text-[13px] leading-[1.21] text-muted">{stat.label}</p>
              <p className="mt-1 truncate text-[24px] font-semibold leading-none text-ink">{stat.value}</p>
            </div>
          </article>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          to="/teller/requests"
          className="flex items-center justify-between gap-4 rounded-[24px] border border-surface-line bg-white p-5 transition-colors hover:bg-surface-card/60"
        >
          <div>
            <p className="text-[16px] font-semibold">Review pending requests</p>
            <p className="mt-1 text-sm text-muted">
              {requests.length} request{requests.length === 1 ? '' : 's'} awaiting approval.
            </p>
          </div>
          <span className="flex h-11 w-11 flex-none items-center justify-center rounded-[14px] bg-surface-card text-primary">
            <HistoryIcon className="h-5 w-5" />
          </span>
        </Link>
        <Link
          to="/teller/transactions"
          className="flex items-center justify-between gap-4 rounded-[24px] border border-surface-line bg-white p-5 transition-colors hover:bg-surface-card/60"
        >
          <div>
            <p className="text-[16px] font-semibold">Process a transaction</p>
            <p className="mt-1 text-sm text-muted">Look up a customer and record a deposit or withdrawal.</p>
          </div>
          <span className="flex h-11 w-11 flex-none items-center justify-center rounded-[14px] bg-emerald-50 text-emerald-600">
            <TransferIcon className="h-5 w-5" />
          </span>
        </Link>
      </div>

      <section className="overflow-hidden rounded-[28px] border border-surface-line bg-white">
        <div className="flex items-center justify-between gap-3 px-5 py-4 sm:px-6">
          <h2 className="text-[18px] font-semibold leading-[1.21]">Recent activity</h2>
          <Link to="/teller/transactions" className="text-sm font-medium text-primary hover:underline">
            View all
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left">
            <thead className="bg-surface-soft text-[12px] uppercase tracking-wide text-muted">
              <tr>
                <th className="px-5 py-3 font-medium sm:px-6">Date</th>
                <th className="px-5 py-3 font-medium sm:px-6">Customer</th>
                <th className="px-5 py-3 font-medium sm:px-6">Account</th>
                <th className="px-5 py-3 font-medium sm:px-6">Type</th>
                <th className="px-5 py-3 text-right font-medium sm:px-6">Amount</th>
                <th className="px-5 py-3 font-medium sm:px-6">Reference</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-line">
              {(recent?.items ?? []).map((tx) => (
                <tr key={tx.id}>
                  <td className="px-5 py-4 text-sm text-muted sm:px-6">
                    {tx.createdAt ? formatDateTime(tx.createdAt) : '—'}
                  </td>
                  <td className="px-5 py-4 text-sm font-semibold sm:px-6">{tx.customerName ?? '—'}</td>
                  <td className="px-5 py-4 text-sm text-muted sm:px-6">
                    {tx.accountLabel ?? 'Account'} · {tx.accountNumber ?? '—'}
                  </td>
                  <td className="px-5 py-4 sm:px-6">
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold capitalize ${typeTone[tx.type] ?? 'bg-gray-100 text-gray-600'}`}>
                      {tx.type === 'withdraw' ? 'withdrawal' : tx.type}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right text-sm font-semibold sm:px-6">
                    {formatCurrency(tx.amount, tx.currency)}
                  </td>
                  <td className="px-5 py-4 font-mono text-xs sm:px-6">{tx.reference}</td>
                </tr>
              ))}
              {(recent?.items.length ?? 0) === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-sm text-muted">
                    {loading ? 'Loading activity…' : 'No transactions processed yet.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
};

export default TellerDashboardPage;
