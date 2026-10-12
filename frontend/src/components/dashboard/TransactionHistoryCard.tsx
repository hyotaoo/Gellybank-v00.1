import ChevronRightIcon from '@/components/icons/ChevronRightIcon';
import TransactionList from '@/components/dashboard/TransactionList';
import { useAccounts } from '@/context/AccountContext';

const TransactionHistoryCard = () => {
  const { selectedAccount } = useAccounts();

  return (
    <section className="flex h-[500px] flex-1 flex-col gap-6 overflow-hidden rounded-[36px] border border-surface-line bg-surface-soft p-8">
      <header className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-[20px] font-normal leading-[1.21] text-ink">Transaction History</h2>
          <button
            type="button"
            aria-label="View transaction details"
            className="flex h-5 w-5 items-center justify-center text-ink transition-opacity hover:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-hover"
          >
            <ChevronRightIcon className="h-[18px] w-[18px]" />
          </button>
        </div>
        <span className="block h-px w-full bg-ink/10" />
      </header>

      <TransactionList
        accountId={selectedAccount?.id ?? null}
        currency={selectedAccount?.currency}
        limit={6}
      />
    </section>
  );
};

export default TransactionHistoryCard;
