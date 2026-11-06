import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { ApiError } from '@/api/client';
import { createTransaction } from '@/api/transactions';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import InfoIcon from '@/components/icons/InfoIcon';
import { useAccounts } from '@/context/AccountContext';
import { formatAccountNumber, formatCurrency } from '@/utils/format';
import { AccountPickerCard } from '@/components/cash/AccountCards';
import { SoftAmountBox } from '@/components/cash/AmountBox';
import { RequestTimeline } from '@/components/cash/RequestTimeline';
import {
  CashWorkspace,
  DetailsCard,
  Divider,
  ReviewHeading,
  ReviewPanel,
  ReviewRow,
  ReviewSummary,
  ReviewTotal,
  SecurityNote,
  SubmitButton,
  initialsFor,
} from '@/components/cash/CashShell';

export type CashRequestKind = 'deposit' | 'withdraw';
type Status = 'idle' | 'loading' | 'success' | 'error';

const COPY = {
  deposit: {
    pageTitle: 'Deposit',
    heading: 'Request',
    accountLabel: 'Receiving account',
    fee: 'No deposit fee',
    approval:
      'This request will be reviewed by a teller before the deposit is credited to your account.',
    reviewTitle: 'Deposit Review',
    totalLabel: 'Amount to process',
    defaultReference: 'Deposit request',
    successMessage: 'Deposit request submitted. A teller will review it shortly.',
  },
  withdraw: {
    pageTitle: 'Withdraw',
    heading: 'Request',
    accountLabel: 'Source account',
    fee: 'No withdrawal fee',
    approval:
      'This request will be reviewed by a teller before the withdrawal is processed.',
    reviewTitle: 'Withdrawal Review',
    totalLabel: 'Amount to process',
    defaultReference: 'Withdrawal request',
    successMessage: 'Withdrawal request submitted. A teller will review it shortly.',
  },
} as const;

const CashRequestPage = ({ kind }: { kind: CashRequestKind }) => {
  const copy = COPY[kind];
  const { accounts, selectedAccount, refresh } = useAccounts();
  const [accountId, setAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState<string>();

  useEffect(() => {
    if (!accountId && selectedAccount) setAccountId(selectedAccount.id);
  }, [accountId, selectedAccount]);

  const account = accounts.find((entry) => entry.id === accountId) ?? null;
  const parsedAmount = Number.parseFloat(amount) || 0;
  const balance = account?.balance ?? 0;
  const projectedBalance = kind === 'deposit' ? balance + parsedAmount : balance - parsedAmount;

  const amountError =
    kind === 'withdraw' && parsedAmount > balance
      ? 'Amount exceeds available balance'
      : undefined;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (status === 'loading') return;

    if (!account) {
      setStatus('error');
      setMessage('Select an account to continue.');
      return;
    }
    if (parsedAmount <= 0) {
      setStatus('error');
      setMessage('Enter an amount greater than ₱0.00.');
      return;
    }
    if (amountError) {
      setStatus('error');
      setMessage('The amount exceeds your available balance.');
      return;
    }

    setStatus('loading');
    setMessage(undefined);
    try {
      await createTransaction({
        accountId: account.id,
        type: kind,
        amount: parsedAmount,
        note: note.trim() || undefined,
      });
      await refresh();
      setStatus('success');
      setMessage(copy.successMessage);
    } catch (error) {
      setStatus('error');
      setMessage(
        error instanceof ApiError ? error.message : 'Something went wrong. Please try again.',
      );
    }
  };

  const stage: 0 | 1 | 2 = status === 'success' ? 2 : status === 'loading' ? 1 : 0;
  const sourceValue = kind === 'deposit' ? 'Cash deposit' : account?.label ?? '—';
  const destinationValue = kind === 'deposit' ? account?.label ?? '—' : 'Cash Withdrawal';

  return (
    <DashboardLayout title={copy.pageTitle}>
      <form onSubmit={handleSubmit} className="w-full">
        <CashWorkspace>
          <DetailsCard>
            <div className="flex flex-none flex-col gap-2">
              <h2 className="text-[36px] font-semibold leading-[43px] text-ink">{copy.heading}</h2>
            </div>

            <div className="flex flex-none flex-col gap-3">
              <p className="text-[18px] font-semibold leading-[22px] text-ink">{copy.accountLabel}</p>
              <AccountPickerCard
                accounts={accounts}
                value={accountId}
                onChange={(id) => {
                  setAccountId(id);
                  setStatus('idle');
                  setMessage(undefined);
                }}
              />
            </div>

            <div className="flex flex-none flex-col gap-2">
              <label
                htmlFor={`${kind}-amount`}
                className="text-[16px] font-semibold leading-[19px] text-ink"
              >
                Amount
              </label>
              <SoftAmountBox
                id={`${kind}-amount`}
                value={amount}
                onChange={(next) => {
                  setAmount(next);
                  if (status === 'error') {
                    setStatus('idle');
                    setMessage(undefined);
                  }
                }}
              />
              <div className="flex items-center justify-between text-[14px] leading-[17px]">
                <span className="text-muted">Balance: {formatCurrency(balance)}</span>
                <span className={amountError ? 'text-red-600' : 'font-semibold text-primary'}>
                  {amountError ?? copy.fee}
                </span>
              </div>
            </div>

            <div className="flex flex-none flex-col gap-2">
              <label
                htmlFor={`${kind}-reference`}
                className="text-[16px] font-semibold leading-[19px] text-ink"
              >
                Reference (optional)
              </label>
              <textarea
                id={`${kind}-reference`}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                className="h-[91px] w-full resize-none rounded-[24px] bg-surface-card p-6 text-[16px] font-normal leading-[19px] text-ink outline-none placeholder:text-muted"
              />
            </div>

            <div className="flex h-16 flex-none items-center gap-3 rounded-[20px] border border-surface-line bg-surface-card px-4">
              <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-white">
                <InfoIcon className="h-[18px] w-[18px] text-primary" />
              </span>
              <p className="text-[14px] font-normal leading-[17px] text-[#6E6168]">{copy.approval}</p>
            </div>

            <div className="mt-auto">
              <RequestTimeline stage={stage} />
            </div>
          </DetailsCard>

          <ReviewPanel>
            <ReviewHeading title={copy.reviewTitle} centered />

            <ReviewSummary
              initials={initialsFor(account?.label)}
              name={account?.label ?? 'No account selected'}
              detail={
                account
                  ? `Account No. ${formatAccountNumber(account.accountNumber)}`
                  : 'Select an account to continue'
              }
            />

            <Divider />

            <div className="flex flex-none flex-col gap-5">
              <ReviewRow
                label="Amount"
                value={parsedAmount > 0 ? formatCurrency(parsedAmount) : '₱0.00'}
              />
              <ReviewRow label="Source" value={sourceValue} />
              <ReviewRow label="Destination" value={destinationValue} />
              <ReviewRow
                label="Reference"
                value={note.trim() || copy.defaultReference}
              />
            </div>

            <div className="mt-auto">
              <ReviewTotal
                label={copy.totalLabel}
                amount={formatCurrency(parsedAmount)}
                note={`Balance after approval: ${formatCurrency(projectedBalance)}`}
                className="h-[177px] justify-center"
              />
            </div>

            <div className="flex flex-none flex-col gap-4">
              <SubmitButton label="Submit request" disabled={status === 'loading'} />
              {message ? (
                <p
                  className={`text-center text-[13px] font-normal leading-[16px] ${
                    status === 'success' ? 'text-[#43814C]' : 'text-red-600'
                  }`}
                >
                  {message}
                </p>
              ) : (
                <SecurityNote>Safe and secure with GellyBank</SecurityNote>
              )}
            </div>
          </ReviewPanel>
        </CashWorkspace>
      </form>
    </DashboardLayout>
  );
};

export default CashRequestPage;