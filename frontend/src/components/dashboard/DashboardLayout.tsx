import type { ReactNode } from 'react';
import ScrollArea from '@/components/common/ScrollArea';
import DashboardHeader from '@/components/dashboard/DashboardHeader';
import Sidebar from '@/components/dashboard/Sidebar';

interface DashboardLayoutProps {
  title: string;
  children: ReactNode;
}

const DashboardLayout = ({ title, children }: DashboardLayoutProps) => {
  return (
    <div className="customer-shell min-h-[100dvh] w-full bg-[#FFFCF7] font-sans text-ink">
      <div className="flex min-h-[100dvh] flex-col bg-[#FFFCF7] lg:h-[100dvh] lg:flex-row lg:overflow-hidden">
        <Sidebar />
        <main className="flex min-w-0 flex-1 flex-col">
          <DashboardHeader title={title} />
          <ScrollArea
            className="px-4 pb-6 sm:px-6 lg:px-[14px]"
            wrapperClassName="flex min-h-0 flex-1 flex-col"
            contentClassName="flex min-h-full flex-col gap-6"
            trackInsetTop={0}
            trackInsetBottom={16}
          >
            {children}
          </ScrollArea>
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
