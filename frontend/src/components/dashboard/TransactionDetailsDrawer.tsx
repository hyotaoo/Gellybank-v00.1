import { useEffect, useRef } from 'react';
import type { Account } from '@/api/accounts';
import type { Transaction } from '@/api/transactions';
import CloseIcon from '@/components/icons/CloseIcon';
import ClockIcon from '@/components/icons/ClockIcon';
import DownloadIcon from '@/components/icons/DownloadIcon';
import { formatCurrency, maskAccountNumber } from '@/utils/format';
import { downloadReceipt } from '@/utils/receipt';
import {
  dateLabel,
  drawerDescription,
  statusCopy,
  timeLabel,
  typeCopy,
} from '@/utils/transactionDisplay';

interface TransactionDetailsDrawerProps {
  transaction: Transaction | null;
  account: Account | null;
  open: boolean;
  onClose: () => void;
}

const Detail = ({
  label,
  value,
  className = '',
}: {
  label: string;
  value: string;
  className?: string;
}) => (
  <div className={`flex min-w-0 flex-col gap-1.5 ${className}`}>
    <span className="text-[13px] font-normal leading-[16px] text-[#6E6168]">{label}</span>
    <span
      className="block truncate text-[16px] font-semibold leading-[19px] text-ink"
      title={value}
    >
      {value}
    </span>
  </div>
);

const TransactionDetailsDrawer = ({
  transaction,
  account,
  open,
  onClose,
}: TransactionDetailsDrawerProps) => {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    closeButtonRef.current?.focus();

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  const typeInfo = transaction ? typeCopy[transaction.type] : null;
  const badge = transaction ? statusCopy[transaction.status] : null;
  const TypeIcon = typeInfo?.icon;
  const isDeposit = transaction?.type === 'deposit';
  const receiptReady = transaction?.status === 'completed';
  const accountContext = account
    ? `GellyBank ${account.label} ${maskAccountNumber(account.accountNumber)}`
    : 'Account unavailable';

  const partyLabel = isDeposit ? 'From' : 'To';
  const partyValue = transaction
    ? isDeposit
      ? 'Cash deposit'
      : (transaction.counterparty ??
        (transaction.type === 'withdraw' ? 'Cash withdrawal' : '—'))
    : '';
  const accountLabel = isDeposit ? 'To account' : 'From account';
  const receiptCaption = receiptReady
    ? 'PDF receipt · Completed transaction'
    : transaction?.status === 'pending'
      ? 'PDF receipt · Available once completed'
      : `PDF receipt · ${badge?.label ?? 'Unavailable'} transaction`;

  return (
    <aside
      id="transaction-details-drawer"
      data-testid="transaction-drawer"
      role="region"
      aria-label="Transaction details"
      aria-hidden={!open && !transaction}
      className={`absolute right-0 top-0 flex h-full w-[337px] flex-none flex-col overflow-hidden rounded-[36px] bg-white/90 p-8 ring-1 ring-inset ring-surface-line transition-transform duration-300 ease-out motion-reduce:transition-none ${
        open ? 'translate-x-0' : 'pointer-events-none translate-x-full'
      }`}
    >
      {transaction && typeInfo && badge && TypeIcon ? (
        <div data-testid="drawer-content" className="flex h-full flex-col gap-6">
          <div data-testid="drawer-heading" className="flex flex-none flex-col gap-3.5">
            <div className="flex items-center justify-between gap-2.5">
              <h2 className="min-w-0 flex-1 text-[30px] font-bold leading-[33px] text-ink">
                Transaction details
              </h2>
              <button
                ref={closeButtonRef}
                type="button"
                aria-label="Close transaction details"
                tabIndex={open ? undefined : -1}
                onClick={onClose}
                className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-surface-card text-[#6E6168] transition-colors hover:bg-blush hover:text-ink"
              >
                <CloseIcon className="h-4 w-4" />
              </button>
            </div>
            <div className="h-px w-full bg-ink/25" />
          </div>

          <div data-testid="drawer-summary" className="flex flex-none flex-col items-center gap-3.5 rounded-[24px] bg-white p-5 ring-1 ring-inset ring-surface-line">
            <span className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-surface-card">
              <TypeIcon className="h-6 w-6 text-primary" />
            </span>
            <div className="flex w-full flex-col items-center gap-1.5 text-center">
              <span className="text-[16px] font-semibold leading-[19px] text-ink">
                {typeInfo.label}
              </span>
              <span
                className={`text-[36px] font-bold leading-[43px] ${
                  isDeposit ? 'text-[#43814C]' : 'text-ink'
                }`}
              >
                {isDeposit ? '+' : '−'}
                {formatCurrency(transaction.amount, transaction.currency)}
              </span>
            </div>
            <span
              className="flex h-7 items-center gap-1.5 rounded-full px-[9px] text-[13px] font-semibold leading-[16px]"
              style={{ backgroundColor: badge.bg, color: badge.text }}
            >
              <span
                className="h-[5px] w-[5px] rounded-full"
                style={{ backgroundColor: badge.dot }}
              />
              {badge.label}
            </span>
          </div>

          <div data-testid="drawer-info" className="flex flex-none flex-col gap-5">
            <Detail label={partyLabel} value={partyValue} />
            <Detail label="Description" value={drawerDescription(transaction)} />
            <div className="flex gap-3">
              <Detail label="Date" value={dateLabel(transaction.createdAt)} className="flex-1" />
              <Detail
                label="Time"
                value={timeLabel(transaction.createdAt) || '—'}
                className="flex-1"
              />
            </div>
            <Detail label="Reference number" value={transaction.reference} />
            <div className="h-px w-full bg-surface-line" />
            <Detail label={accountLabel} value={accountContext} />
          </div>

          <div data-testid="drawer-actions" className="flex flex-none flex-col gap-3">
            {receiptReady ? (
              <button
                type="button"
                tabIndex={open ? undefined : -1}
                onClick={() => downloadReceipt(transaction, account)}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-[16px] bg-blush text-[16px] font-semibold leading-[19px] text-primary transition-colors hover:bg-primary/10"
              >
                <DownloadIcon className="h-[18px] w-[18px]" />
                Download receipt
              </button>
            ) : (
              <button
                type="button"
                disabled
                tabIndex={open ? undefined : -1}
                className="flex h-12 w-full cursor-not-allowed items-center justify-center gap-2 rounded-[16px] bg-surface-card text-[16px] font-semibold leading-[19px] text-muted"
              >
                <ClockIcon className="h-[18px] w-[18px]" />
                Receipt unavailable
              </button>
            )}
            <span className="text-center text-[13px] font-normal leading-[16px] text-[#6E6168]">
              {receiptCaption}
            </span>
          </div>
        </div>
      ) : null}
    </aside>
  );
};

export default TransactionDetailsDrawer;
