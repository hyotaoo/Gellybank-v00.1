import type { ReactNode } from 'react';
import DashboardHeader from '@/components/dashboard/DashboardHeader';
import Sidebar from '@/components/dashboard/Sidebar';

interface DashboardLayoutProps {
  title: string;
  children: ReactNode;
}

const DashboardLayout = ({ title, children }: DashboardLayoutProps) => {
  return (
    <div className="min-h-[100dvh] w-full bg-[#FFFCF7] font-sans text-ink">
      <div className="flex min-h-[100dvh] flex-col bg-[#FFFCF7] lg:h-[100dvh] lg:flex-row lg:overflow-hidden">
        <Sidebar />
        <main className="flex min-w-0 flex-1 flex-col">
          <DashboardHeader title={title} />
          <div className="flex flex-1 flex-col gap-6 px-4 pb-6 sm:px-6 lg:overflow-y-auto lg:px-[14px]">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
