import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { ApiError, setAuthToken } from '@/api/client';
import { getAdminDashboard } from '@/api/admin';

const navItems = [
  { label: 'Overview', to: '/admin/dashboard' },
  { label: 'Manage users', to: '/admin/users' },
  { label: 'Applications', to: '/admin/applications' },
  { label: 'Audit logs', to: '/admin/logs' },
];

const AdminLayout = () => {
  const navigate = useNavigate();
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [error, setError] = useState<string>();

  useEffect(() => {
    const controller = new AbortController();
    getAdminDashboard(controller.signal)
      .then(() => setCheckingAccess(false))
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          setAuthToken(null);
          navigate('/admin/login', { replace: true });
          return;
        }
        setError(err instanceof Error ? err.message : 'Unable to verify admin access.');
        setCheckingAccess(false);
      });
    return () => controller.abort();
  }, [navigate]);

  if (checkingAccess) {
    return <main className="p-8 text-muted">Verifying admin access…</main>;
  }
  if (error) {
    return (
      <main className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 p-8 text-center">
        <p role="alert" className="text-red-700">{error}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-xl bg-primary px-5 py-3 font-semibold text-ink"
        >
          Retry
        </button>
      </main>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-[#FFFCF7] font-sans text-ink lg:flex">
      <aside className="flex w-full flex-col bg-white p-5 shadow-[4px_0_20px_1px_rgba(0,0,0,0.05)] lg:min-h-[100dvh] lg:w-[280px] lg:p-7">
        <h1 className="text-[28px] font-bold leading-none">
          Gelly<span className="text-primary">Bank!</span>
        </h1>
        <p className="mt-2 text-sm text-muted">Admin Portal</p>
        <nav aria-label="Admin navigation" className="mt-6 flex gap-2 overflow-x-auto lg:flex-col">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `shrink-0 rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
                  isActive ? 'bg-surface-card text-primary' : 'hover:bg-surface-card/60'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <button
          type="button"
          onClick={() => {
            setAuthToken(null);
            navigate('/admin/login', { replace: true });
          }}
          className="mt-6 rounded-xl border border-surface-line px-4 py-3 text-left text-sm hover:bg-surface-card lg:mt-auto"
        >
          Sign out
        </button>
      </aside>
      <main className="min-w-0 flex-1 p-4 sm:p-7 lg:p-10">
        <Outlet />
      </main>
    </div>
  );
};

export default AdminLayout;
