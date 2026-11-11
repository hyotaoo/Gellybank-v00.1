import type { ReactNode } from 'react';
import NotificationsDropdown from '@/components/dashboard/NotificationsDropdown';

interface TellerHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

const TellerHeader = ({ title, subtitle, actions }: TellerHeaderProps) => (
  <header className="flex flex-wrap items-center justify-between gap-3">
    <div>
      <h1 className="text-[30px] font-semibold leading-none text-primary sm:text-[36px]">{title}</h1>
      {subtitle && <p className="mt-2 text-sm text-muted">{subtitle}</p>}
    </div>
    <div className="flex flex-wrap items-center gap-3">
      {actions}
      <NotificationsDropdown scope="teller" />
    </div>
  </header>
);

export default TellerHeader;
