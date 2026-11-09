import { setAuthToken } from '@/api/client';
import PortalShell from '@/components/portal/PortalShell';
import type { PortalNavItem } from '@/components/portal/PortalShell';
import CreditCardIcon from '@/components/icons/CreditCardIcon';
import HistoryIcon from '@/components/icons/HistoryIcon';
import HomeIcon from '@/components/icons/HomeIcon';
import ProfileIcon from '@/components/icons/ProfileIcon';
import TransferIcon from '@/components/icons/TransferIcon';
import WalletIcon from '@/components/icons/WalletIcon';
import SettingsIcon from '@/components/icons/SettingsIcon';

const navItems: PortalNavItem[] = [
  { label: 'Overview', to: '/admin/dashboard', icon: <HomeIcon className="h-5 w-5" /> },
  { label: 'Manage users', to: '/admin/users', icon: <ProfileIcon className="h-5 w-5" /> },
  { label: 'Accounts', to: '/admin/accounts', icon: <WalletIcon className="h-5 w-5" /> },
  { label: 'Transactions', to: '/admin/transactions', icon: <TransferIcon className="h-5 w-5" /> },
  { label: 'Reports', to: '/admin/reports', icon: <HistoryIcon className="h-5 w-5" /> },
  { label: 'Applications', to: '/admin/applications', icon: <CreditCardIcon className="h-5 w-5" /> },
  { label: 'Card requests', to: '/admin/card-requests', icon: <CreditCardIcon className="h-5 w-5" /> },
  { label: 'Audit logs', to: '/admin/logs', icon: <HistoryIcon className="h-5 w-5" /> },
  { label: 'Backups', to: '/admin/backups', icon: <WalletIcon className="h-5 w-5" /> },
  { label: 'Settings', to: '/admin/settings', icon: <SettingsIcon className="h-5 w-5" /> },
  { label: 'Admin profile', to: '/admin/profile', icon: <ProfileIcon className="h-5 w-5" /> },
];

const AdminLayout = () => (
  <PortalShell
    portal="Admin Portal"
    navItems={navItems}
    userName="Admin User"
    userRole="Administrator"
    signOutTo="/admin/login"
    onSignOut={() => setAuthToken(null, 'admin')}
  />
);

export default AdminLayout;
