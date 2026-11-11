import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { TransactionRequest } from '@/api/requests';
import Button from '@/components/common/Button';
import CopyButton from '@/components/common/CopyButton';
import ScrollArea from '@/components/common/ScrollArea';
import CircleCheckIcon from '@/components/icons/CircleCheckIcon';
import { formatAccountNumber, formatCurrency, formatDateTime } from '@/utils/format';

interface RequestSubmittedModalProps {
  request: TransactionRequest;
  onClose: () => void;
}

const typeLabel: Record<string, string> = {
  deposit: 'Deposit',
  withdrawal: 'Withdrawal',
};

const RequestSubmittedModal = ({ request, onClose }: RequestSubmittedModalProps) => {
  const navigate = useNavigate();

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

  const rows: Array<{ label: string; value: string; copy?: string }> = [
    { label: 'Reference', value: request.reference, copy: request.reference },
    { label: 'Account', value: request.accountLabel ?? 'Account' },
  ];

  if (request.accountNumber) {
    rows.push({
      label: 'Account number',
      value: formatAccountNumber(request.accountNumber),
      copy: request.accountNumber,
    });
  }
  if (request.note) {
    rows.push({ label: 'Note', value: request.note });
  }
  if (request.createdAt) {
    rows.push({ label: 'Submitted', value: formatDateTime(request.createdAt) });
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
        aria-labelledby="request-submitted-title"
        className="max-h-[92dvh] w-full max-w-[440px]"
      >
        <ScrollArea
          className="max-h-[92dvh] rounded-t-[28px] bg-white shadow-2xl sm:rounded-[28px]"
          contentClassName="p-6 sm:p-8"
          trackInsetTop={16}
          trackInsetBottom={16}
          hideRail
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-surface-card text-primary">
                <CircleCheckIcon className="h-6 w-6" />
              </span>
              <div>
                <h2 id="request-submitted-title" className="text-[18px] font-semibold leading-[1.21] text-ink">
                  Request submitted
                </h2>
                <p className="mt-1 text-[12px] leading-[1.21] text-muted">Gellybank service request</p>
              </div>
            </div>
            <span className="rounded-full bg-amber-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-amber-700">
              {request.status}
            </span>
          </div>

          <div className="mt-7 text-center">
            <p className="text-[34px] font-extrabold leading-[1.1] tracking-tight text-ink">
              {formatCurrency(request.amount, request.currency)}
            </p>
            <p className="mt-2 text-[12px] leading-[1.21] text-muted">
              {typeLabel[request.type] ?? request.type} · awaiting teller approval
            </p>
          </div>

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

          <p className="mt-5 text-center text-[11px] leading-[1.5] text-muted">
            A teller will review this request. Your balance updates once it is approved.
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
              onClick={() => {
                onClose();
                navigate('/dashboard/requests');
              }}
              className="h-11 flex-1 justify-center px-5 text-[14px] font-semibold"
            >
              View requests
            </Button>
          </div>
        </ScrollArea>
      </div>
    </div>
  );
};

export default RequestSubmittedModal;
