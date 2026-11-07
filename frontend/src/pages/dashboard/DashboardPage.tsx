import AccountSwitcher from '@/components/dashboard/AccountSwitcher';
import AiInsightsCard from '@/components/dashboard/AiInsightsCard';
import BalanceCard from '@/components/dashboard/BalanceCard';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import TransactionHistoryCard from '@/components/dashboard/TransactionHistoryCard';
import { useAccounts } from '@/context/AccountContext';

// Figma "Desktop - Dashboard-Main" (2:56): left column 688, gutter 24, right column 337
const DashboardPage = () => {
  const { accounts, loading, error } = useAccounts();

  return (
    <DashboardLayout title="Dashboard">
      <div className="flex h-full min-h-0 w-full flex-col pl-[14px] pr-[23px] pt-[5px] pb-[39px]">
        <div className="mb-3 flex-none">
          <AccountSwitcher />
        </div>

        {loading ? (
          <p className="text-[14px] text-muted">Loading your accounts&#8230;</p>
        ) : error ? (
          <p className="text-[14px] text-red-600">{error}</p>
        ) : accounts.length === 0 ? (
          <p className="text-[14px] text-muted">
            You don&apos;t have any accounts yet. Open one from the Accounts page to get started.
          </p>
        ) : (
          <div className="flex min-h-0 flex-1 gap-[15px]">
            <div className="flex h-full w-[688px] flex-none flex-col gap-[17px]">
              <BalanceCard />
              <div className="min-h-0 flex-1">
                <TransactionHistoryCard className="w-[691px]" />
              </div>
            </div>
            <div className="h-full w-[337px] flex-none">
              <AiInsightsCard />
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default DashboardPage;
