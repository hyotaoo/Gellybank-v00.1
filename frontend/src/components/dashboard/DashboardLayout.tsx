import type { ReactNode } from 'react';
import DashboardHeader from '@/components/dashboard/DashboardHeader';
import Sidebar from '@/components/dashboard/Sidebar';
import useFitScale, { DESIGN_HEIGHT, DESIGN_WIDTH } from '@/hooks/useFitScale';
import { isGuestSession } from '@/api/client';

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
          {isGuestSession() && (
            <p className="mx-[14px] rounded-[16px] border border-primary/20 bg-primary/5 px-4 py-2 text-[13px] text-ink">
              Demo mode: changes are saved in this browser only. No real money is moved.
            </p>
          )}
          <div className="flex flex-1 flex-col gap-[24px] overflow-hidden px-[14px] pb-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
