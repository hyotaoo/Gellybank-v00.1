import { setAuthToken } from '@/api/client';
import PortalShell from '@/components/portal/PortalShell';
import type { PortalNavItem } from '@/components/portal/PortalShell';
import CreditCardIcon from '@/components/icons/CreditCardIcon';
import HistoryIcon from '@/components/icons/HistoryIcon';
import HomeIcon from '@/components/icons/HomeIcon';
import ProfileIcon from '@/components/icons/ProfileIcon';

const navItems: PortalNavItem[] = [
  { label: 'Overview', to: '/admin/dashboard', icon: <HomeIcon className="h-5 w-5" /> },
  { label: 'Manage users', to: '/admin/users', icon: <ProfileIcon className="h-5 w-5" /> },
  { label: 'Applications', to: '/admin/applications', icon: <CreditCardIcon className="h-5 w-5" /> },
  { label: 'Audit logs', to: '/admin/logs', icon: <HistoryIcon className="h-5 w-5" /> },
];

const AdminLayout = () => (
  <PortalShell
    portal="Admin Portal"
    navItems={navItems}
    userName="Admin User"
    userRole="Administrator"
    signOutTo="/admin/login"
    onSignOut={() => setAuthToken(null)}
  />
);

export default AdminLayout;
