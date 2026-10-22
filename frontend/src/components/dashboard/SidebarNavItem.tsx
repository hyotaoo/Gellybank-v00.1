import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';

interface SidebarNavItemProps {
  icon: ReactNode;
  label: string;
  to: string;
  end?: boolean;
}

const SidebarNavItem = ({ icon, label, to, end = false }: SidebarNavItemProps) => (
  <NavLink
    to={to}
    end={end}
    className={({ isActive }) =>
      `relative flex h-[48px] shrink-0 items-center gap-3 overflow-hidden rounded-[16px] px-4 text-[16px] leading-[1.21] transition-colors lg:h-[56px] lg:gap-5 lg:pl-5 lg:pr-5 lg:text-[20px] ${
        isActive ? 'bg-surface-card text-primary' : 'text-ink hover:bg-surface-card/60'
      }`
    }
  >
    {({ isActive }) => (
      <>
        {isActive && (
          <span className="absolute left-0 top-1/2 h-[34px] w-1 -translate-y-1/2 rounded-r-full bg-primary" />
        )}
        <span className="flex h-6 w-6 flex-none items-center justify-center">{icon}</span>
        <span>{label}</span>
      </>
    )}
  </NavLink>
);

export default SidebarNavItem;
