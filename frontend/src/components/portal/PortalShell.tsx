import type { ReactNode } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import LogOutIcon from '@/components/icons/LogOutIcon';

export interface PortalNavItem {
  label: string;
  to: string;
  icon: ReactNode;
}

interface PortalShellProps {
  portal: string;
  navItems: PortalNavItem[];
  userName: string;
  userRole: string;
  signOutTo: string;
  onSignOut?: () => void;
}

const PortalShell = ({
  portal,
  navItems,
  userName,
  userRole,
  signOutTo,
  onSignOut,
}: PortalShellProps) => {
  const navigate = useNavigate();
  const initials = userName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  return (
    <div className="min-h-[100dvh] bg-[#FFFCF7] font-sans text-ink lg:flex">
      <aside className="flex w-full flex-col border-b border-surface-line bg-white px-4 py-5 lg:min-h-[100dvh] lg:w-[280px] lg:flex-none lg:border-b-0 lg:px-6 lg:py-7 lg:shadow-[4px_0_20px_1px_rgba(0,0,0,0.05)]">
        <div>
          <h1 className="text-[28px] font-bold leading-none">
            Gelly<span className="text-primary">Bank!</span>
          </h1>
          <p className="mt-2 text-sm text-muted">{portal}</p>
        </div>

        <nav
          aria-label={`${portal} navigation`}
          className="mt-6 flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible"
        >
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex shrink-0 items-center gap-3 rounded-[16px] px-4 py-3 text-sm font-medium transition-colors ${
                  isActive ? 'bg-surface-card text-primary' : 'text-ink hover:bg-surface-card/60'
                }`
              }
            >
              <span className="flex h-5 w-5 flex-none items-center justify-center">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="mt-5 flex items-center gap-3 rounded-[18px] bg-surface-soft p-3 lg:mt-auto">
          <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary">
            {initials}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{userName}</p>
            <p className="truncate text-xs text-muted">{userRole}</p>
          </div>
          <button
            type="button"
            aria-label="Sign out"
            title="Sign out"
            onClick={() => {
              onSignOut?.();
              navigate(signOutTo, { replace: true });
            }}
            className="flex h-9 w-9 flex-none items-center justify-center rounded-full text-muted transition-colors hover:bg-white hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-hover"
          >
            <LogOutIcon className="h-5 w-5" />
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-4 py-4 sm:px-6 sm:py-6 lg:h-[100dvh] lg:overflow-y-auto lg:px-10 lg:py-8 xl:px-16">
        <div className="mx-auto w-full max-w-[1240px]">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default PortalShell;
