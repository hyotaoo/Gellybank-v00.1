import AccountSwitcher from '@/components/dashboard/AccountSwitcher';
import AiInsightsCard from '@/components/dashboard/AiInsightsCard';
import BalanceCard from '@/components/dashboard/BalanceCard';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import DashboardSkeleton from '@/components/dashboard/DashboardSkeleton';
import TransactionHistoryCard from '@/components/dashboard/TransactionHistoryCard';
import { useAccounts } from '@/context/AccountContext';

const DashboardPage = () => {
  const { accounts, loading, error } = useAccounts();

  return (
    <DashboardLayout title="Dashboard">
      <AccountSwitcher />

      {loading ? (
        <DashboardSkeleton />
      ) : error ? (
        <p className="text-[14px] text-red-600">{error}</p>
      ) : accounts.length === 0 ? (
        <p className="text-[14px] text-muted">
          You don&apos;t have any accounts yet. Open one from the Accounts page to get started.
        </p>
      ) : (
        <>
          <BalanceCard />
          <div className="flex flex-col gap-6 lg:h-[500px] lg:flex-row">
            <TransactionHistoryCard />
            <AiInsightsCard />
          </div>
        </>
      )}
    </DashboardLayout>
  );
};

export default DashboardPage;
