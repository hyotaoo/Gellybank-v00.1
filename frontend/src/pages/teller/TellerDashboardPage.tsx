import DepositIcon from '@/components/icons/DepositIcon';
import ProfileIcon from '@/components/icons/ProfileIcon';
import TransferIcon from '@/components/icons/TransferIcon';
import WithdrawIcon from '@/components/icons/WithdrawIcon';
import { formatCurrency } from '@/utils/format';

const stats = [
  { label: 'Transactions today', value: '48', icon: <TransferIcon className="h-5 w-5" />, tone: 'bg-surface-card text-primary' },
  { label: 'Deposits', value: formatCurrency(128400), icon: <DepositIcon className="h-5 w-5" />, tone: 'bg-emerald-50 text-emerald-600' },
  { label: 'Withdrawals', value: formatCurrency(76250), icon: <WithdrawIcon className="h-5 w-5" />, tone: 'bg-amber-50 text-amber-600' },
  { label: 'Customers served', value: '23', icon: <ProfileIcon className="h-5 w-5" />, tone: 'bg-sky-50 text-sky-600' },
];

type TellerTransaction = {
  customer: string;
  type: 'Deposit' | 'Withdrawal' | 'Transfer';
  amount: number;
  time: string;
  status: 'completed' | 'pending';
};

const transactions: TellerTransaction[] = [
  { customer: 'Maria Santos', type: 'Deposit', amount: 25000, time: '09:42', status: 'completed' },
  { customer: 'Liam Reyes', type: 'Withdrawal', amount: 8500, time: '09:18', status: 'completed' },
  { customer: 'Sofia Cruz', type: 'Transfer', amount: 12000, time: '08:55', status: 'completed' },
  { customer: 'Noah Garcia', type: 'Deposit', amount: 5400, time: '08:31', status: 'pending' },
];

const typeTone: Record<TellerTransaction['type'], string> = {
  Deposit: 'bg-emerald-50 text-emerald-600',
  Withdrawal: 'bg-amber-50 text-amber-600',
  Transfer: 'bg-surface-card text-primary',
};

const statusTone: Record<TellerTransaction['status'], string> = {
  completed: 'bg-emerald-50 text-emerald-700',
  pending: 'bg-amber-50 text-amber-700',
};

const TellerDashboardPage = () => (
  <section className="flex flex-col gap-6">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-[30px] font-semibold leading-none text-primary sm:text-[36px]">Teller Dashboard</h1>
      <span className="rounded-full border border-surface-line bg-white px-4 py-2 text-xs font-medium text-muted">
        Today
      </span>
    </header>

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
        <h2 className="text-[18px] font-semibold leading-[1.21]">Recent transactions</h2>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left">
          <thead className="bg-surface-soft text-[12px] uppercase tracking-wide text-muted">
            <tr>
              <th className="px-5 py-3 font-medium sm:px-6">Customer</th>
              <th className="px-5 py-3 font-medium sm:px-6">Type</th>
              <th className="px-5 py-3 text-right font-medium sm:px-6">Amount</th>
              <th className="px-5 py-3 font-medium sm:px-6">Time</th>
              <th className="px-5 py-3 font-medium sm:px-6">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-line">
            {transactions.map((transaction) => (
              <tr key={`${transaction.customer}-${transaction.time}`}>
                <td className="px-5 py-4 text-sm font-semibold sm:px-6">{transaction.customer}</td>
                <td className="px-5 py-4 sm:px-6">
                  <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${typeTone[transaction.type]}`}>
                    {transaction.type}
                  </span>
                </td>
                <td className="px-5 py-4 text-right text-sm font-semibold sm:px-6">
                  {formatCurrency(transaction.amount)}
                </td>
                <td className="px-5 py-4 text-sm text-muted sm:px-6">{transaction.time}</td>
                <td className="px-5 py-4 sm:px-6">
                  <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold capitalize ${statusTone[transaction.status]}`}>
                    {transaction.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  </section>
);

export default TellerDashboardPage;
