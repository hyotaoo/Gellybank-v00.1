import AccountSwitcher from '@/components/dashboard/AccountSwitcher';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import TransactionList from '@/components/dashboard/TransactionList';
import { useAccounts } from '@/context/AccountContext';

const HistoryPage = () => {
  const { selectedAccount, loading, error, accounts } = useAccounts();

  return (
    <DashboardLayout title="History">
      <div className="flex flex-1 flex-col gap-5 overflow-hidden">
        <AccountSwitcher />

        <section className="flex flex-1 flex-col gap-6 overflow-hidden rounded-[36px] border border-surface-line bg-surface-soft p-8">
          <div className="flex items-center justify-between">
            <h2 className="text-[20px] font-normal leading-[1.21] text-ink">
              {selectedAccount ? `${selectedAccount.label} transactions` : 'Transactions'}
            </h2>
          </div>
          <span className="block h-px w-full bg-ink/10" />

          {loading ? (
            <p className="text-[14px] text-muted">Loading accounts…</p>
          ) : error ? (
            <p className="text-[14px] text-red-600">{error}</p>
          ) : accounts.length === 0 ? (
            <p className="text-[14px] text-muted">You have no accounts yet.</p>
          ) : (
            <TransactionList
              accountId={selectedAccount?.id ?? null}
              currency={selectedAccount?.currency}
            />
          )}
        </section>
      </div>
    </DashboardLayout>
  );
};

export default HistoryPage;
