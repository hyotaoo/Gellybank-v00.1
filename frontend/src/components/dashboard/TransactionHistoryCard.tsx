import ChevronRightIcon from '@/components/icons/ChevronRightIcon';
import TransactionList from '@/components/dashboard/TransactionList';
import { useAccounts } from '@/context/AccountContext';

interface TransactionHistoryCardProps {
  className?: string;
}

// Figma 9:29 — 691 wide, r36, p32, white card, ink hairline under the title
const TransactionHistoryCard = ({ className = '' }: TransactionHistoryCardProps) => {
  const { selectedAccount } = useAccounts();

  return (
    <section className={`flex h-full flex-col gap-6 overflow-hidden rounded-[36px] border border-surface-line bg-white p-8 ${className}`}>
      <header className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-[36px] font-semibold leading-[43px] text-ink">Transaction History</h2>
          <button
            type="button"
            aria-label="View transaction details"
            className="flex h-[41px] w-[41px] items-center justify-center transition-opacity hover:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-hover"
          >
            <ChevronRightIcon className="h-[31px] w-[31px]" />
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
