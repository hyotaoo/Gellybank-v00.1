import AccountTypeBadge from '@/components/dashboard/AccountTypeBadge';
import { useAccounts } from '@/context/AccountContext';
import { formatCurrency } from '@/utils/format';

const AccountSwitcher = () => {
  const { accounts, selectedAccountId, selectAccount, loading } = useAccounts();

  if (loading || accounts.length === 0) return null;

  return (
    <div
      role="tablist"
      aria-label="Select account"
      className="flex flex-wrap items-center gap-3"
    >
      {accounts.map((account) => {
        const active = account.id === selectedAccountId;

        return (
          <button
            key={account.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => selectAccount(account.id)}
            className={`flex items-center gap-3 rounded-[20px] border px-4 py-2.5 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-hover ${
              active
                ? 'border-primary bg-surface-card'
                : 'border-surface-line bg-white hover:border-primary/60'
            }`}
          >
            <AccountTypeBadge type={account.type} />
            <span className="flex flex-col">
              <span className="text-[14px] font-semibold leading-[1.21] text-ink">
                {account.label}
              </span>
              <span className="text-[13px] leading-[1.21] text-muted">
                {formatCurrency(account.balance, account.currency)}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
};

export default AccountSwitcher;
