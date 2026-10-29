import PortalShell from '@/components/portal/PortalShell';
import type { PortalNavItem } from '@/components/portal/PortalShell';
import HomeIcon from '@/components/icons/HomeIcon';

const navItems: PortalNavItem[] = [
  { label: 'Overview', to: '/teller/dashboard', icon: <HomeIcon className="h-5 w-5" /> },
];

const TellerLayout = () => (
  <PortalShell
    portal="Teller Portal"
    navItems={navItems}
    userName="Teller User"
    userRole="Bank Teller"
    signOutTo="/teller/login"
  />
);

export default TellerLayout;
