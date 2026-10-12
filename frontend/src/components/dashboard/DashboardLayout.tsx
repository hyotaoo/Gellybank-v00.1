import type { ReactNode } from 'react';
import DashboardHeader from '@/components/dashboard/DashboardHeader';
import Sidebar from '@/components/dashboard/Sidebar';
import useFitScale, { DESIGN_HEIGHT, DESIGN_WIDTH } from '@/hooks/useFitScale';

interface DashboardLayoutProps {
  title: string;
  children: ReactNode;
}

const DashboardLayout = ({ title, children }: DashboardLayoutProps) => {
  const scale = useFitScale();

  return (
    <div className="flex h-[100dvh] w-full items-center justify-center overflow-hidden bg-[#FFFCF7] font-sans text-ink">
      <div
        className="relative flex shrink-0 overflow-hidden bg-[#FFFCF7]"
        style={{
          width: DESIGN_WIDTH,
          height: DESIGN_HEIGHT,
          transform: `scale(${scale})`,
        }}
      >
        <Sidebar />
        <main className="flex min-w-0 flex-1 flex-col">
          <DashboardHeader title={title} />
          <div className="flex flex-1 flex-col gap-[24px] overflow-hidden px-[14px] pb-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
