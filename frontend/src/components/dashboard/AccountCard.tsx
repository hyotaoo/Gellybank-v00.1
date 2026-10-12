import type { Account } from '@/api/accounts';
import AccountTypeBadge from '@/components/dashboard/AccountTypeBadge';
import CircleCheckIcon from '@/components/icons/CircleCheckIcon';
import { formatAccountNumber, formatCurrency } from '@/utils/format';

interface AccountCardProps {
  account: Account;
  onClose?: (account: Account) => void;
  onSetPrimary?: (account: Account) => void;
  busy?: boolean;
}

const AccountCard = ({ account, onClose, onSetPrimary, busy = false }: AccountCardProps) => {
  const isClosed = account.status === 'closed';
  const canClose = account.balance === 0 && !account.isPrimary && !isClosed;

  return (
    <article className="flex flex-col gap-4 rounded-[28px] border border-surface-line bg-surface-soft p-6">
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <h3 className="text-[18px] font-semibold leading-[1.21] text-ink">{account.label}</h3>
            {account.isPrimary && (
              <span className="rounded-full bg-primary/15 px-2.5 py-1 text-[12px] font-semibold text-primary">
                Primary
              </span>
            )}
          </div>
          <span className="text-[13px] leading-[1.21] text-muted">
            {formatAccountNumber(account.accountNumber)}
          </span>
        </div>
        <AccountTypeBadge type={account.type} />
      </div>

      <p className="text-[32px] font-bold leading-[1.21] tracking-[-0.02em] text-ink">
        {formatCurrency(account.balance, account.currency)}
      </p>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[13px] leading-[1.21] text-muted">
        {account.type === 'savings' && (
          <span>Interest rate: {((account.interestRate ?? 0) * 100).toFixed(2)}% p.a.</span>
        )}
        {account.type === 'checking' && account.overdraftLimit ? (
          <span>Overdraft: {formatCurrency(account.overdraftLimit, account.currency)}</span>
        ) : null}
        {account.type === 'savings' && account.monthlyWithdrawalLimit ? (
          <span>
            Withdrawals this month: {account.withdrawalsThisMonth ?? 0}/
            {account.monthlyWithdrawalLimit}
          </span>
        ) : null}
        <span className="flex items-center gap-1.5">
          <CircleCheckIcon className="h-3.5 w-3.5" />
          {account.status}
        </span>
      </div>

      {(onSetPrimary || onClose) && (
        <div className="flex items-center gap-3 pt-1">
          {onSetPrimary && !account.isPrimary && !isClosed && (
            <button
              type="button"
              disabled={busy}
              onClick={() => onSetPrimary(account)}
              className="h-10 rounded-full bg-surface-card px-4 text-[14px] font-semibold text-ink transition-colors hover:bg-primary hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              Set as primary
            </button>
          )}
          {onClose && !isClosed && (
            <button
              type="button"
              disabled={busy || !canClose}
              title={canClose ? 'Close account' : 'Only empty, non-primary accounts can be closed'}
              onClick={() => onClose(account)}
              className="h-10 rounded-full border border-surface-line px-4 text-[14px] font-semibold text-primary transition-colors hover:border-primary disabled:cursor-not-allowed disabled:opacity-50"
            >
              Close account
            </button>
          )}
        </div>
      )}
    </article>
  );
};

export default AccountCard;
