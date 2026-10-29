import { useEffect } from 'react';
import type { Account } from '@/api/accounts';
import type { Transaction } from '@/api/transactions';
import Button from '@/components/common/Button';
import CopyButton from '@/components/common/CopyButton';
import CircleCheckIcon from '@/components/icons/CircleCheckIcon';
import { formatAccountNumber, formatCurrency, formatDateTime } from '@/utils/format';
import {
  printTransactionReceipt,
  receiptAmount,
  receiptAmountPrefix,
  receiptTypeLabel,
} from '@/utils/receipt';

interface ReceiptModalProps {
  transaction: Transaction;
  account?: Account | null;
  onClose: () => void;
}

const statusTone: Record<Transaction['status'], string> = {
  completed: 'bg-emerald-50 text-emerald-700',
  pending: 'bg-amber-50 text-amber-700',
  failed: 'bg-red-50 text-red-700',
  void: 'bg-surface-card text-muted',
};

const ReceiptModal = ({ transaction, account, onClose }: ReceiptModalProps) => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    const previousOverflow = document.body.style.overflow;

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  const currency = transaction.currency || account?.currency || 'PHP';
  const isDeposit = transaction.type === 'deposit';

  const handlePrint = () => {
    if (!printTransactionReceipt(transaction, account)) {
      window.alert('Allow pop-ups for this site to print or save your receipt.');
    }
  };

  const rows: Array<{ label: string; value: string; copy?: string }> = [
    { label: 'Date', value: formatDateTime(transaction.createdAt) },
    { label: 'Type', value: receiptTypeLabel(transaction.type) },
    { label: 'Account', value: account?.label ?? '—' },
    {
      label: 'Account number',
      value: account ? formatAccountNumber(account.accountNumber) : '—',
      copy: account?.accountNumber,
    },
  ];

  if (transaction.counterparty) {
    rows.push({ label: 'Recipient', value: transaction.counterparty });
  }
  if (transaction.note) {
    rows.push({ label: 'Note', value: transaction.note });
  }
  if (typeof transaction.balanceAfter === 'number') {
    rows.push({ label: 'Balance after', value: formatCurrency(transaction.balanceAfter, currency) });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="receipt-title"
        className="max-h-[92dvh] w-full max-w-[440px] overflow-y-auto rounded-t-[28px] bg-white p-6 shadow-2xl sm:rounded-[28px] sm:p-8"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-surface-card text-primary">
              <CircleCheckIcon className="h-6 w-6" />
            </span>
            <div>
              <h2 id="receipt-title" className="text-[18px] font-semibold leading-[1.21] text-ink">
                Receipt ready
              </h2>
              <p className="mt-1 text-[12px] leading-[1.21] text-muted">Gellybank transaction receipt</p>
            </div>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide ${statusTone[transaction.status]}`}
          >
            {transaction.status}
          </span>
        </div>

        <div className="mt-7 text-center">
          <p
            className={`text-[34px] font-extrabold leading-[1.1] tracking-tight ${
              isDeposit ? 'text-emerald-600' : 'text-ink'
            }`}
          >
            {receiptAmountPrefix(transaction.type)}
            {receiptAmount(transaction, account)}
          </p>
          <p className="mt-2 text-[12px] leading-[1.21] text-muted">
            {receiptTypeLabel(transaction.type)}
            {transaction.counterparty ? ` · ${transaction.counterparty}` : ''}
          </p>
        </div>

        <div className="mt-6 border-t border-dashed border-ink/15 pt-2">
          <dl className="flex flex-col">
            <div className="flex items-start justify-between gap-4 border-b border-dashed border-surface-line py-3">
              <dt className="text-[13px] leading-[1.21] text-muted">Reference</dt>
              <dd className="flex items-center gap-1 text-right text-[13px] font-semibold leading-[1.21] text-ink">
                {transaction.reference}
                <CopyButton value={transaction.reference} label="Copy reference" />
              </dd>
            </div>
            {rows.map((row) => (
              <div
                key={row.label}
                className="flex items-start justify-between gap-4 border-b border-dashed border-surface-line py-3"
              >
                <dt className="text-[13px] leading-[1.21] text-muted">{row.label}</dt>
                <dd className="flex items-center gap-1 text-right text-[13px] font-semibold leading-[1.21] text-ink">
                  <span className="break-words">{row.value}</span>
                  {row.copy && <CopyButton value={row.copy} label={`Copy ${row.label.toLowerCase()}`} />}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <p className="mt-5 text-center text-[11px] leading-[1.5] text-muted">
          This serves as your official transaction receipt.
          <br />
          Thank you for banking with Gellybank.
        </p>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            className="h-11 flex-1 justify-center px-5 text-[14px] font-semibold"
          >
            Done
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={handlePrint}
            className="h-11 flex-1 justify-center px-5 text-[14px] font-semibold"
          >
            Print / Save PDF
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ReceiptModal;
