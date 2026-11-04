import { useEffect, useState } from 'react';
import { ApiError } from '@/api/client';
import { listTellerRequests } from '@/api/requests';
import type { TellerRequest } from '@/api/requests';
import { formatCurrency } from '@/utils/format';
import DepositIcon from '@/components/icons/DepositIcon';
import ProfileIcon from '@/components/icons/ProfileIcon';
import TransferIcon from '@/components/icons/TransferIcon';
import WithdrawIcon from '@/components/icons/WithdrawIcon';

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

const TellerDashboardPage = () => {
  const [requests, setRequests] = useState<TellerRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  const refresh = async () => {
    setLoading(true);
    setError(undefined);
    try {
      setRequests(await listTellerRequests('all'));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to load requests.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const pending = requests.filter((request) => request.status === 'pending');
  const todayStr = new Date().toDateString();
  const today = requests.filter(
    (request) => request.reviewedAt && new Date(request.reviewedAt).toDateString() === todayStr,
  );
  const processedToday = today.filter((request) => request.status === 'approved');
  const depositsToday = processedToday
    .filter((request) => request.type === 'deposit')
    .reduce((sum, request) => sum + request.amount, 0);
  const withdrawalsToday = processedToday
    .filter((request) => request.type === 'withdrawal')
    .reduce((sum, request) => sum + request.amount, 0);
  const customersToday = new Set(today.map((request) => request.customerId)).size;

  const stats = [
    { label: 'Pending requests', value: String(pending.length), icon: <TransferIcon className="h-5 w-5" />, tone: 'bg-surface-card text-primary' },
    { label: 'Deposits processed today', value: formatCurrency(depositsToday), icon: <DepositIcon className="h-5 w-5" />, tone: 'bg-emerald-50 text-emerald-600' },
    { label: 'Withdrawals processed today', value: formatCurrency(withdrawalsToday), icon: <WithdrawIcon className="h-5 w-5" />, tone: 'bg-amber-50 text-amber-600' },
    { label: 'Customers served today', value: String(customersToday), icon: <ProfileIcon className="h-5 w-5" />, tone: 'bg-sky-50 text-sky-600' },
  ];

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[30px] font-semibold leading-none text-primary sm:text-[36px]">Teller Dashboard</h1>
        <span className="rounded-full border border-surface-line bg-white px-4 py-2 text-xs font-medium text-muted">
          Today
        </span>
      </header>

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

      <section className="overflow-hidden rounded-[28px] border border-surface-line bg-white">
        <div className="flex items-center justify-between gap-3 px-5 py-4 sm:px-6">
          <h2 className="text-[18px] font-semibold leading-[1.21]">Recent requests</h2>
          <a href="#/teller/requests" className="text-sm font-medium text-primary hover:underline">
            View all
          </a>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left">
            <thead className="bg-surface-soft text-[12px] uppercase tracking-wide text-muted">
              <tr>
                <th className="px-5 py-3 font-medium sm:px-6">Customer</th>
                <th className="px-5 py-3 font-medium sm:px-6">Type</th>
                <th className="px-5 py-3 text-right font-medium sm:px-6">Amount</th>
                <th className="px-5 py-3 font-medium sm:px-6">Submitted</th>
                <th className="px-5 py-3 font-medium sm:px-6">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-line">
              {requests.slice(0, 8).map((request) => (
                <tr key={request.id}>
                  <td className="px-5 py-4 text-sm font-semibold sm:px-6">{request.customerName}</td>
                  <td className="px-5 py-4 sm:px-6">
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold capitalize ${typeTone[request.type]}`}>
                      {request.type}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right text-sm font-semibold sm:px-6">
                    {formatCurrency(request.amount, request.currency)}
                  </td>
                  <td className="px-5 py-4 text-sm text-muted sm:px-6">
                    {request.createdAt ? new Date(request.createdAt).toLocaleString() : '—'}
                  </td>
                  <td className="px-5 py-4 sm:px-6">
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold capitalize ${statusTone[request.status]}`}>
                      {request.status}
                    </span>
                  </td>
                </tr>
              ))}
              {requests.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-sm text-muted">
                    {loading ? 'Loading requests…' : 'No requests yet.'}
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
