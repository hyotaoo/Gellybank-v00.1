import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';

interface SidebarNavItemProps {
  icon: ReactNode;
  label: string;
  to: string;
  end?: boolean;
}

// Figma 45:921 — 331x56, r16, px20, gap20, 20px/400. The 4x34 indicator is hidden in Figma.
const SidebarNavItem = ({ icon, label, to, end = false }: SidebarNavItemProps) => (
  <NavLink
    to={to}
    end={end}
    className={({ isActive }) =>
      `relative flex h-14 w-full items-center gap-5 overflow-hidden rounded-[16px] px-5 text-[20px] leading-[24px] transition-colors ${
        isActive ? 'bg-blush text-primary' : 'text-ink hover:bg-blush/50'
      }`
    }
  >
    <span className="flex h-6 w-6 flex-none items-center justify-center">{icon}</span>
    <span>{label}</span>
  </NavLink>
);

export default SidebarNavItem;
