import { useEffect } from 'react';
import type { ReactNode } from 'react';
import type { RequestType, TransactionRequest } from '@/api/requests';
import Button from '@/components/common/Button';
import CopyButton from '@/components/common/CopyButton';
import ScrollArea from '@/components/common/ScrollArea';
import CreditCardIcon from '@/components/icons/CreditCardIcon';
import DepositIcon from '@/components/icons/DepositIcon';
import WithdrawIcon from '@/components/icons/WithdrawIcon';
import { formatAccountNumber, formatCurrency, formatDateTime } from '@/utils/format';

interface RequestDetailModalProps {
  request: TransactionRequest;
  onClose: () => void;
}

const statusTone: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700',
  approved: 'bg-emerald-50 text-emerald-700',
  rejected: 'bg-red-50 text-red-700',
  cancelled: 'bg-gray-100 text-gray-600',
};

const typeTone: Record<string, string> = {
  deposit: 'bg-emerald-50 text-emerald-600',
  withdrawal: 'bg-amber-50 text-amber-600',
  card: 'bg-surface-card text-primary',
  card_lost: 'bg-red-50 text-red-600',
};

const typeLabel: Record<string, string> = {
  deposit: 'Deposit',
  withdrawal: 'Withdrawal',
  card: 'Card',
  card_lost: 'Lost card',
};

const typeIcon: Record<RequestType, ReactNode> = {
  deposit: <DepositIcon className="h-6 w-6" />,
  withdrawal: <WithdrawIcon className="h-6 w-6" />,
  card: <CreditCardIcon className="h-6 w-6" />,
  card_lost: <CreditCardIcon className="h-6 w-6" />,
};

const isMoneyRequest = (type: RequestType) => type === 'deposit' || type === 'withdrawal';

const RequestDetailModal = ({ request, onClose }: RequestDetailModalProps) => {
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

  const showAmount = isMoneyRequest(request.type);

  const rows: Array<{ label: string; value: string; copy?: string }> = [
    { label: 'Type', value: typeLabel[request.type] ?? request.type },
    { label: 'Account', value: request.accountLabel ?? 'Account' },
  ];

  if (request.accountNumber) {
    rows.push({
      label: 'Account number',
      value: formatAccountNumber(request.accountNumber),
      copy: request.accountNumber,
    });
  }
  if (showAmount) {
    rows.push({ label: 'Amount', value: formatCurrency(request.amount, request.currency) });
  }
  rows.push({ label: 'Note', value: request.note ?? '—' });
  rows.push({
    label: 'Submitted',
    value: request.createdAt ? formatDateTime(request.createdAt) : '—',
  });
  if (request.reviewedAt) {
    rows.push({
      label: 'Reviewed',
      value: `${formatDateTime(request.reviewedAt)}${request.reviewedByRole ? ` by ${request.reviewedByRole}` : ''}`,
    });
  }
  if (request.status === 'rejected' && request.rejectionReason) {
    rows.push({ label: 'Rejection reason', value: request.rejectionReason });
  }
  if (request.transactionId) {
    rows.push({ label: 'Transaction ID', value: request.transactionId, copy: request.transactionId });
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
        aria-labelledby="request-detail-title"
        className="max-h-[92dvh] w-full max-w-[440px]"
      >
        <ScrollArea
          className="max-h-[92dvh] rounded-t-[28px] bg-white shadow-2xl sm:rounded-[28px]"
          contentClassName="p-6 sm:p-8"
          trackInsetTop={16}
          trackInsetBottom={16}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className={`flex h-11 w-11 flex-none items-center justify-center rounded-full ${typeTone[request.type]}`}>
                {typeIcon[request.type]}
              </span>
              <div>
                <h2 id="request-detail-title" className="text-[18px] font-semibold leading-[1.21] text-ink">
                  Request details
                </h2>
                <p className="mt-1 text-[12px] leading-[1.21] text-muted">Gellybank service request</p>
              </div>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide ${statusTone[request.status]}`}
            >
              {request.status}
            </span>
          </div>

          {showAmount && (
            <div className="mt-7 text-center">
              <p className="text-[34px] font-extrabold leading-[1.1] tracking-tight text-ink">
                {formatCurrency(request.amount, request.currency)}
              </p>
              <p className="mt-2 text-[12px] leading-[1.21] text-muted">
                {typeLabel[request.type] ?? request.type}
              </p>
            </div>
          )}

          <div className="mt-6 border-t border-dashed border-ink/15 pt-2">
            <dl className="flex flex-col">
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

          <div className="mt-6">
            <Button
              type="button"
              variant="primary"
              onClick={onClose}
              className="h-11 w-full justify-center px-5 text-[14px] font-semibold"
            >
              Done
            </Button>
          </div>
        </ScrollArea>
      </div>
    </div>
  );
};

export default RequestDetailModal;
