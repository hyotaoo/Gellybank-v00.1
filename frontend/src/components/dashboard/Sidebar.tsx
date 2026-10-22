import { useNavigate } from 'react-router-dom';
import AiInsightsIcon from '@/components/icons/AiInsightsIcon';
import DepositIcon from '@/components/icons/DepositIcon';
import HistoryIcon from '@/components/icons/HistoryIcon';
import HomeIcon from '@/components/icons/HomeIcon';
import LogOutIcon from '@/components/icons/LogOutIcon';
import ProfileIcon from '@/components/icons/ProfileIcon';
import TransferIcon from '@/components/icons/TransferIcon';
import WalletIcon from '@/components/icons/WalletIcon';
import WithdrawIcon from '@/components/icons/WithdrawIcon';
import SidebarNavItem from '@/components/dashboard/SidebarNavItem';
import { setAuthToken } from '@/api/client';

const navItems = [
  { label: 'Dashboard', to: '/dashboard', end: true, icon: <HomeIcon className="h-6 w-6" /> },
  { label: 'Accounts', to: '/dashboard/accounts', icon: <WalletIcon className="h-6 w-6" /> },
  { label: 'Deposit', to: '/dashboard/deposit', icon: <DepositIcon className="h-6 w-6" /> },
  { label: 'Withdraw', to: '/dashboard/withdraw', icon: <WithdrawIcon className="h-6 w-6" /> },
  { label: 'Transfer', to: '/dashboard/transfer', icon: <TransferIcon className="h-6 w-6" /> },
  { label: 'History', to: '/dashboard/history', icon: <HistoryIcon className="h-6 w-6" /> },
  { label: 'AI Insights', to: '/dashboard/insights', icon: <AiInsightsIcon className="h-6 w-6" /> },
  { label: 'Profile', to: '/dashboard/profile', icon: <ProfileIcon className="h-6 w-6" /> },
];

const Sidebar = () => {
  const navigate = useNavigate();

  const handleSignOut = () => {
    setAuthToken(null);
    navigate('/login');
  };

  return (
    <aside className="relative z-10 flex w-full flex-none flex-col bg-white shadow-[4px_0_20px_1px_rgba(0,0,0,0.05)] lg:h-full lg:w-[363px]">
      <div className="px-4 pt-5 lg:px-[18px] lg:pt-[80px]">
        <h1 className="text-[32px] font-bold leading-none tracking-[-0.02em] text-ink">
          Gelly<span className="text-primary">Bank!</span>
        </h1>
      </div>

      <nav aria-label="Primary" className="flex gap-1 overflow-x-auto px-4 py-4 lg:flex-col lg:overflow-y-auto lg:pt-[32px]">
        {navItems.map((item) => (
          <SidebarNavItem
            key={item.label}
            icon={item.icon}
            label={item.label}
            to={item.to}
            end={item.end}
          />
        ))}
      </nav>

      <div className="border-t-2 border-surface-line px-4 py-3 lg:mt-auto lg:py-6">
        <button
          type="button"
          onClick={handleSignOut}
          className="flex h-12 w-full items-center gap-4 rounded-[14px] pl-5 text-[18px] leading-[1.21] text-primary transition-colors hover:bg-surface-card focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-hover"
        >
          <LogOutIcon className="h-6 w-6" />
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
