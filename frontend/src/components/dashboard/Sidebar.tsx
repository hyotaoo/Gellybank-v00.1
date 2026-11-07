import { Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import { setAuthToken } from '@/api/client';
import DepositIcon from '@/components/icons/DepositIcon';
import HistoryIcon from '@/components/icons/HistoryIcon';
import HomeIcon from '@/components/icons/HomeIcon';
import LogOutIcon from '@/components/icons/LogOutIcon';
import ProfileIcon from '@/components/icons/ProfileIcon';
import TargetIcon from '@/components/icons/TargetIcon';
import TransferIcon from '@/components/icons/TransferIcon';
import WithdrawIcon from '@/components/icons/WithdrawIcon';
import SidebarNavItem from '@/components/dashboard/SidebarNavItem';

// Order and grouping follow Figma "Desktop - Dashboard-Main" (2:56) / Sidebar (45:171)
const navItems = [
  { label: 'Dashboard', to: '/dashboard', end: true, icon: <HomeIcon className="h-6 w-6" /> },
  { label: 'Transfer', to: '/dashboard/transfer', icon: <TransferIcon className="h-6 w-6" /> },
  { label: 'Deposit', to: '/dashboard/deposit', icon: <DepositIcon className="h-6 w-6" /> },
  { label: 'Withdraw', to: '/dashboard/withdraw', icon: <WithdrawIcon className="h-6 w-6" /> },
  { label: 'Requests', to: '/dashboard/requests', icon: <HistoryIcon className="h-6 w-6" /> },
  { label: 'History', to: '/dashboard/history', icon: <HistoryIcon className="h-6 w-6" /> },
  { label: 'AI Insights', to: '/dashboard/insights', icon: <TargetIcon className="h-6 w-6" /> },
  { label: 'Profile', to: '/dashboard/profile', icon: <ProfileIcon className="h-6 w-6" /> },
];

// Figma 45:171 — one rule after every nav item except Profile.
const hasDividerAfter = (index: number) => index < navItems.length - 1;

const Sidebar = () => {
  const navigate = useNavigate();

  const handleSignOut = () => {
    setAuthToken(null, 'customer');
    navigate('/login');
  };

  return (
    <aside className="relative z-10 flex h-full w-[363px] flex-none flex-col bg-cream/20 shadow-sidebar">
      <div className="relative h-[141px] w-full flex-none">
        {/* Figma 3:1330 — "Gelly" is rose, "Bank" is deep ink. */}
        <h1 className="absolute left-[29px] top-[58px] text-[64px] font-black leading-[77px] tracking-[-0.01em]">
          <span className="text-rose-300">Gelly</span>
          <span className="text-[#331B29]">Bank</span>
        </h1>
        <span
          className="absolute left-4 top-[137px] block h-px w-[331px] bg-gold/15"
          aria-hidden="true"
        />
      </div>

      {/* The 1px top rule is transparent in Figma, but still separates the brand from the nav. */}
      <nav
        aria-label="Primary"
        className="mt-px flex min-h-0 w-full flex-1 flex-col gap-1 overflow-y-auto px-4"
      >
        {navItems.map((item, index) => (
          <Fragment key={item.label}>
            <SidebarNavItem
              icon={item.icon}
              label={item.label}
              to={item.to}
              end={item.end}
            />
            {hasDividerAfter(index) && (
              <span className="block h-px w-full flex-none bg-gold/15" aria-hidden="true" />
            )}
          </Fragment>
        ))}
      </nav>

      <span className="block h-px w-full flex-none bg-surface-line" aria-hidden="true" />
      <div className="px-4 py-3">
        <button
          type="button"
          onClick={handleSignOut}
          className="flex h-14 w-full items-center gap-5 rounded-[16px] px-5 text-[20px] leading-[24px] text-primary transition-colors hover:bg-blush/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-hover"
        >
          <LogOutIcon className="h-6 w-6" />
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
