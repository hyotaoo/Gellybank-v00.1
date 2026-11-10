import NotificationsDropdown from '@/components/dashboard/NotificationsDropdown';
import ProfileDropdown from '@/components/dashboard/ProfileDropdown';

interface DashboardHeaderProps {
  title?: string;
}

const DashboardHeader = ({ title = 'Dashboard' }: DashboardHeaderProps) => {
  return (
    <header className="flex flex-none flex-col gap-4 px-4 py-6 sm:px-6 md:flex-row md:items-center md:justify-between lg:h-[120px] lg:pl-[14px] lg:pr-[30px] lg:pt-[33px]">
      <h1 className="text-[30px] font-semibold leading-none text-primary sm:text-[36px]">{title}</h1>

      <div className="flex items-center gap-3 self-end sm:gap-6 md:self-auto">
        <NotificationsDropdown />
        <ProfileDropdown />
      </div>
    </header>
  );
};

export default DashboardHeader;
