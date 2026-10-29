import { Link } from 'react-router-dom';
import ChevronRightIcon from '@/components/icons/ChevronRightIcon';
import CircleCheckIcon from '@/components/icons/CircleCheckIcon';
import CreditCardIcon from '@/components/icons/CreditCardIcon';
import HistoryIcon from '@/components/icons/HistoryIcon';
import ProfileIcon from '@/components/icons/ProfileIcon';
import WalletIcon from '@/components/icons/WalletIcon';
import { formatCurrency } from '@/utils/format';

const stats = [
  { label: 'Total users', value: '1,284', icon: <ProfileIcon className="h-5 w-5" />, tone: 'bg-surface-card text-primary' },
  { label: 'Pending applications', value: '18', icon: <WalletIcon className="h-5 w-5" />, tone: 'bg-amber-50 text-amber-600' },
  { label: 'Total accounts', value: '2,046', icon: <CreditCardIcon className="h-5 w-5" />, tone: 'bg-sky-50 text-sky-600' },
  { label: 'System health', value: 'Healthy', icon: <CircleCheckIcon className="h-5 w-5" />, tone: 'bg-emerald-50 text-emerald-600', valueTone: 'text-emerald-600' },
];

const applications = [
  { name: 'Maria Santos', type: 'Savings', amount: 25000, time: '09:42' },
  { name: 'Liam Reyes', type: 'Checking', amount: 8500, time: '09:18' },
  { name: 'Sofia Cruz', type: 'Savings', amount: 12000, time: '08:55' },
];

const quickActions = [
  { label: 'Manage users', to: '/admin/users', icon: <ProfileIcon className="h-5 w-5" /> },
  { label: 'Review applications', to: '/admin/applications', icon: <WalletIcon className="h-5 w-5" /> },
  { label: 'Audit logs', to: '/admin/logs', icon: <HistoryIcon className="h-5 w-5" /> },
];

const initials = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

const AdminDashboardPage = () => (
  <section className="flex flex-col gap-6">
    <h1 className="text-[30px] font-semibold leading-none text-primary sm:text-[36px]">Admin Dashboard</h1>

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
            <p className={`mt-1 text-[24px] font-semibold leading-none ${stat.valueTone ?? 'text-ink'}`}>
              {stat.value}
            </p>
          </div>
        </article>
      ))}
    </div>

    <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
      <section className="rounded-[28px] border border-surface-line bg-white p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[18px] font-semibold leading-[1.21]">Pending applications</h2>
          <Link to="/admin/applications" className="text-sm font-medium text-primary hover:underline">
            View all
          </Link>
        </div>

        <div className="mt-3 divide-y divide-surface-line">
          {applications.map((application) => (
            <div key={application.name} className="flex items-center gap-3 py-3">
              <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-surface-card text-xs font-bold text-primary">
                {initials(application.name)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold leading-[1.21]">{application.name}</p>
                <p className="mt-0.5 text-xs leading-[1.21] text-muted">
                  {application.type} · {application.time}
                </p>
              </div>
              <p className="text-sm font-semibold leading-[1.21]">{formatCurrency(application.amount)}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[28px] border border-surface-line bg-surface-soft p-5 sm:p-6">
        <h2 className="text-[18px] font-semibold leading-[1.21]">Quick actions</h2>

        <div className="mt-4 flex flex-col gap-2">
          {quickActions.map((action) => (
            <Link
              key={action.to}
              to={action.to}
              className="flex items-center gap-3 rounded-[16px] bg-white px-4 py-3 text-sm font-medium transition-colors hover:bg-surface-card focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-hover"
            >
              <span className="flex h-5 w-5 flex-none items-center justify-center text-primary">
                {action.icon}
              </span>
              <span className="flex-1">{action.label}</span>
              <ChevronRightIcon className="h-4 w-4 text-muted" />
            </Link>
          ))}
        </div>
      </section>
    </div>
  </section>
);

export default AdminDashboardPage;
