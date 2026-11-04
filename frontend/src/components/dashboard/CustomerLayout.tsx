import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import type { PortalNavItem } from '@/components/portal/PortalShell';
import HomeIcon from '@/components/icons/HomeIcon';
import ProfileIcon from '@/components/icons/ProfileIcon';
import BellIcon from '@/components/icons/BellIcon';

const navItems: PortalNavItem[] = [
  { label: 'Dashboard', to: '/dashboard', icon: <HomeIcon className="h-5 w-5" /> },
  { label: 'Accounts', to: '/dashboard/accounts', icon: <ProfileIcon className="h-5 w-5" /> },
];

const CustomerLayout = ({ title, children }: { title: string; children: ReactNode }) => (
  <div className="min-h-[100dvh] bg-[#FFFCF7] font-sans text-ink lg:flex">
    <aside className="flex w-full flex-col border-b border-surface-line bg-white px-4 py-5 lg:min-h-[100dvh] lg:w-[220px] lg:flex-none lg:border-b-0 lg:px-6 lg:py-7 lg:shadow-[4px_0_20px_1px_rgba(0,0,0,0.05)]">
      <div>
        <h1 className="text-[28px] font-bold leading-none">
          Gelly<span className="text-primary">Bank!</span>
        </h1>
        <p className="mt-2 text-sm text-muted">{title}</p>
      </div>

      <nav
        aria-label={`${title} navigation`}
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

      <div className="mt-auto flex items-center gap-3 rounded-[18px] bg-surface-soft p-3 lg:mt-7">
        <BellIcon className="h-5 w-5 text-muted" />
        <span className="truncate text-xs text-muted">Notifications</span>
      </div>

      <div className="flex-grow" />

      <div className="flex items-center gap-3 rounded-[18px] bg-primary/5 p-3 lg:mt-4">
        <div className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
          JD
        </div>
        <div className="flex flex-col">
          <p className="font-semibold text-sm">John Doe</p>
          <p className="text-xs text-muted truncate">Customer Account</p>
        </div>
      </div>
    </aside>

    <main className="min-w-0 flex-1 px-4 py-4 sm:px-6 sm:py-6 lg:h-[100dvh] lg:overflow-y-auto lg:px-10 lg:py-8 xl:px-16">
      <div className="mx-auto w-full max-w-[1240px]">
        {children}
      </div>
    </main>
  </div>
);

export default CustomerLayout;
