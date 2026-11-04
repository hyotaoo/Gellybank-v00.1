import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiError } from '@/api/client';
import { getAdminDashboard, listAccountApplications } from '@/api/admin';
import type { AccountApplication, AdminMetrics } from '@/api/admin';
import ChevronRightIcon from '@/components/icons/ChevronRightIcon';
import CircleCheckIcon from '@/components/icons/CircleCheckIcon';
import CreditCardIcon from '@/components/icons/CreditCardIcon';
import HistoryIcon from '@/components/icons/HistoryIcon';
import ProfileIcon from '@/components/icons/ProfileIcon';
import WalletIcon from '@/components/icons/WalletIcon';
import { formatCurrency } from '@/utils/format';

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

const AdminDashboardPage = () => {
  const [metrics, setMetrics] = useState<AdminMetrics>();
  const [applications, setApplications] = useState<AccountApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  useEffect(() => {
    const controller = new AbortController();

    const load = async () => {
      setLoading(true);
      setError(undefined);
      try {
        const [nextMetrics, nextApplications] = await Promise.all([
          getAdminDashboard(controller.signal),
          listAccountApplications('pending', controller.signal),
        ]);
        setMetrics(nextMetrics);
        setApplications(nextApplications);
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err instanceof ApiError ? err.message : 'Unable to load the dashboard.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    void load();
    return () => controller.abort();
  }, []);

  const healthy = metrics?.systemHealth === 'healthy';

  const stats = [
    {
      label: 'Total users',
      value: metrics ? String(metrics.totalUsers) : '—',
      icon: <ProfileIcon className="h-5 w-5" />,
      tone: 'bg-surface-card text-primary',
    },
    {
      label: 'Pending applications',
      value: metrics ? String(metrics.pendingApplications) : '—',
      icon: <WalletIcon className="h-5 w-5" />,
      tone: 'bg-amber-50 text-amber-600',
    },
    {
      label: 'Total accounts',
      value: metrics ? String(metrics.totalAccounts) : '—',
      icon: <CreditCardIcon className="h-5 w-5" />,
      tone: 'bg-sky-50 text-sky-600',
    },
    {
      label: 'System health',
      value: metrics ? (healthy ? 'Healthy' : 'Unavailable') : '—',
      icon: <CircleCheckIcon className="h-5 w-5" />,
      tone: healthy ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600',
      valueTone: healthy ? 'text-emerald-600' : 'text-red-600',
    },
  ];

  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-[30px] font-semibold leading-none text-primary sm:text-[36px]">Admin Dashboard</h1>

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
            {applications.slice(0, 5).map((application) => (
              <div key={application.id} className="flex items-center gap-3 py-3">
                <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-surface-card text-xs font-bold text-primary">
                  {initials(application.customerName)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold leading-[1.21]">{application.customerName}</p>
                  <p className="mt-0.5 text-xs leading-[1.21] text-muted">
                    {application.accountType} ·{' '}
                    {application.createdAt ? new Date(application.createdAt).toLocaleString() : '—'}
                  </p>
                </div>
                <p className="text-sm font-semibold leading-[1.21]">{formatCurrency(application.initialDeposit)}</p>
              </div>
            ))}
            {applications.length === 0 && (
              <p className="py-6 text-center text-sm text-muted">
                {loading ? 'Loading applications…' : 'No pending applications.'}
              </p>
            )}
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
};

export default AdminDashboardPage;
