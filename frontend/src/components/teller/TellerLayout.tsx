import { setAuthToken } from '@/api/client';
import PortalShell from '@/components/portal/PortalShell';
import type { PortalNavItem } from '@/components/portal/PortalShell';
import HomeIcon from '@/components/icons/HomeIcon';
import HistoryIcon from '@/components/icons/HistoryIcon';
import ProfileIcon from '@/components/icons/ProfileIcon';
import TransferIcon from '@/components/icons/TransferIcon';
import WalletIcon from '@/components/icons/WalletIcon';

const navItems: PortalNavItem[] = [
  { label: 'Overview', to: '/teller/dashboard', icon: <HomeIcon className="h-5 w-5" /> },
  { label: 'Requests', to: '/teller/requests', icon: <HistoryIcon className="h-5 w-5" /> },
  { label: 'Transactions', to: '/teller/transactions', icon: <TransferIcon className="h-5 w-5" /> },
  { label: 'Customers', to: '/teller/customers', icon: <WalletIcon className="h-5 w-5" /> },
  { label: 'Reports', to: '/teller/reports', icon: <HistoryIcon className="h-5 w-5" /> },
  { label: 'Profile', to: '/teller/profile', icon: <ProfileIcon className="h-5 w-5" /> },
];

const TellerLayout = () => (
  <PortalShell
    portal="Teller Portal"
    navItems={navItems}
    userName="Teller User"
    userRole="Bank Teller"
    signOutTo="/teller/login"
    onSignOut={() => setAuthToken(null, 'teller')}
  />
);

export default TellerLayout;
