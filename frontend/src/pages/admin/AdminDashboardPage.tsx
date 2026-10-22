import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAdminDashboard } from '@/api/admin';
import type { AdminMetrics } from '@/api/admin';

const AdminDashboardPage = () => {
  const [metrics, setMetrics] = useState<AdminMetrics>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    const controller = new AbortController();
    getAdminDashboard(controller.signal)
      .then(setMetrics)
      .catch((err: unknown) => {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : 'Unable to load admin dashboard.');
        }
      });
    return () => controller.abort();
  }, []);

  return (
    <section className="flex flex-col gap-7">
      <header>
        <h1 className="text-3xl font-semibold text-primary">System overview</h1>
        <p className="mt-2 text-sm text-muted">Monitor users, applications, accounts, and system health.</p>
      </header>

      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {!metrics && !error && <p role="status" className="text-sm text-muted">Loading system metrics…</p>}
      {metrics && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: 'Registered users', value: metrics.totalUsers },
            { label: 'Pending applications', value: metrics.pendingApplications },
            { label: 'System accounts', value: metrics.totalAccounts },
            { label: 'System health', value: metrics.systemHealth },
          ].map((metric) => (
            <article key={metric.label} className="rounded-2xl border border-surface-line bg-white p-5 shadow-sm">
              <p className="text-sm text-muted">{metric.label}</p>
              <p className="mt-3 text-2xl font-semibold capitalize text-ink">{metric.value}</p>
            </article>
          ))}
        </div>
      )}

      <section aria-labelledby="admin-quick-actions">
        <h2 id="admin-quick-actions" className="text-xl font-semibold">Quick actions</h2>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link to="/admin/applications" className="rounded-xl bg-primary px-5 py-3 font-semibold text-ink hover:bg-primary-hover">
            Review applications
          </Link>
          <Link to="/admin/users" className="rounded-xl border border-surface-line bg-white px-5 py-3 font-semibold hover:bg-surface-card">
            Manage users
          </Link>
        </div>
      </section>
    </section>
  );
};

export default AdminDashboardPage;
