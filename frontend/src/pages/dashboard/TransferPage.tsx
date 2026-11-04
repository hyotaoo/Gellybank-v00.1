import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { ApiError } from '@/api/client';
import { createTransfer } from '@/api/transactions';
import { listBeneficiaries } from '@/api/beneficiaries';
import type { Beneficiary } from '@/api/beneficiaries';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import BankIcon from '@/components/icons/BankIcon';
import CircleCheckIcon from '@/components/icons/CircleCheckIcon';
import { SourceAccountCard } from '@/components/cash/AccountCards';
import { OutlinedAmountBox } from '@/components/cash/AmountBox';
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
import { useAccounts } from '@/context/AccountContext';
import { formatAccountNumber, formatCurrency } from '@/utils/format';

type Status = 'idle' | 'loading' | 'success' | 'error';
type Mode = 'internal' | 'external';

interface ResolvedRecipient {
  name: string;
  accountNumber: string;
  bank: string;
  destinationAccountId?: string;
  beneficiaryId?: string;
}

const digitsOnly = (value: string): string => value.replace(/\D/g, '');

const TransferPage = () => {
  const { accounts, selectedAccount, refresh } = useAccounts();
  const [sourceId, setSourceId] = useState('');
  const [mode, setMode] = useState<Mode>('internal');
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [saveRecipient, setSaveRecipient] = useState(false);
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState<string>();

  useEffect(() => {
    if (!sourceId && selectedAccount) setSourceId(selectedAccount.id);
  }, [sourceId, selectedAccount]);

  useEffect(() => {
    const controller = new AbortController();
    listBeneficiaries(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setBeneficiaries(data);
      })
      .catch(() => {
        if (!controller.signal.aborted) setBeneficiaries([]);
      });
    return () => controller.abort();
  }, []);

  const sourceAccount = accounts.find((item) => item.id === sourceId);
  const parsedAmount = Number.parseFloat(amount) || 0;
  const balance = sourceAccount?.balance ?? 0;

  const resolved = useMemo<ResolvedRecipient | null>(() => {
    const typed = digitsOnly(recipient);
    if (typed.length < 4) return null;

    const accountMatch = accounts.find(
      (account) => account.id !== sourceId && digitsOnly(account.accountNumber) === typed,
    );
    const beneficiaryMatch = beneficiaries.find(
      (beneficiary) => digitsOnly(beneficiary.accountNumber) === typed,
    );

    const fromAccount: ResolvedRecipient | null = accountMatch
      ? {
          name: `GellyBank ${accountMatch.label}`,
          accountNumber: accountMatch.accountNumber,
          bank: 'GellyBank',
          destinationAccountId: accountMatch.id,
        }
      : null;
    const fromBeneficiary: ResolvedRecipient | null = beneficiaryMatch
      ? {
          name: beneficiaryMatch.name,
          accountNumber: beneficiaryMatch.accountNumber,
          bank: beneficiaryMatch.bank ?? 'GellyBank',
          beneficiaryId: beneficiaryMatch.id,
        }
      : null;

    return mode === 'internal'
      ? fromAccount ?? fromBeneficiary
      : fromBeneficiary ?? fromAccount;
  }, [accounts, beneficiaries, mode, recipient, sourceId]);

  const amountError = (() => {
    if (!amount) return undefined;
    if (Number.isNaN(parsedAmount) || parsedAmount < 1) return 'Minimum transfer is ₱1.00';
    if (sourceAccount?.type === 'savings' && parsedAmount > balance) {
      return 'Insufficient funds. Savings accounts cannot be overdrawn.';
    }
    if (sourceAccount && parsedAmount > balance + (sourceAccount.overdraftLimit ?? 0)) {
      return 'Amount exceeds your available balance.';
    }
    return undefined;
  })();

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (status === 'loading') return;

    if (!sourceAccount) {
      setStatus('error');
      setMessage('Choose an account to transfer from.');
      return;
    }
    if (!amount || amountError) {
      setStatus('error');
      setMessage(amountError ?? 'Enter an amount to send.');
      return;
    }
    if (!resolved) {
      setStatus('error');
      setMessage('Enter a valid account number to verify the recipient.');
      return;
    }

    setStatus('loading');
    setMessage(undefined);
    try {
      await createTransfer({
        sourceAccountId: sourceAccount.id,
        amount: parsedAmount,
        note: note.trim() || undefined,
        destinationAccountId: resolved.destinationAccountId,
        beneficiaryId: resolved.beneficiaryId,
      });
      await refresh();
      setStatus('success');
      setMessage(`${formatCurrency(parsedAmount, sourceAccount.currency)} sent successfully.`);
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof ApiError ? err.message : 'Transfer failed. Please try again.');
    }
  };

  const recipientName = resolved?.name ?? 'No recipient yet';
  const bankLine = resolved
    ? `${resolved.bank} • ${formatAccountNumber(resolved.accountNumber)}`
    : 'Enter an account number to verify';

  return (
    <DashboardLayout title="Transfer">
      <form onSubmit={handleSubmit} className="w-full">
        <CashWorkspace>
          <DetailsCard gap="gap-4" padding="p-8">
            <div className="flex flex-none flex-col gap-2">
              <h2 className="text-[36px] font-semibold leading-[43px] text-ink">Send money</h2>
            </div>

            <SourceAccountCard accounts={accounts} value={sourceId} onChange={setSourceId} />

            <div className="flex flex-none flex-col gap-3">
              <p className="text-[18px] font-semibold leading-[22px] text-ink">Recipient</p>

              <div
                role="tablist"
                aria-label="Transfer destination"
                className="flex h-12 w-full items-center gap-1 rounded-[16px] bg-surface-card p-1"
              >
                {(
                  [
                    { value: 'internal', label: 'GellyBank account' },
                    { value: 'external', label: 'Other banks' },
                  ] as { value: Mode; label: string }[]
                ).map((tab) => {
                  const active = tab.value === mode;
                  return (
                    <button
                      key={tab.value}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => {
                        setMode(tab.value);
                        setStatus('idle');
                        setMessage(undefined);
                      }}
                      className={`flex h-10 flex-1 items-center justify-center gap-2 rounded-[12px] text-[16px] font-semibold leading-[19px] transition-colors ${
                        active ? 'bg-white text-primary' : 'text-[#6E6168] hover:text-ink'
                      }`}
                    >
                      {active ? <BankIcon className="h-[18px] w-[18px]" /> : null}
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-none flex-col gap-2">
                <label
                  htmlFor="transfer-account-number"
                  className="text-[16px] font-semibold leading-[19px] text-ink"
                >
                  Account number
                </label>
                <input
                  id="transfer-account-number"
                  value={recipient}
                  onChange={(event) => {
                    setRecipient(event.target.value.replace(/[^\d\s]/g, ''));
                    if (status === 'error') {
                      setStatus('idle');
                      setMessage(undefined);
                    }
                  }}
                  inputMode="numeric"
                  autoComplete="off"
                  className="h-[52px] w-full rounded-[16px] border border-[#E8E0D8] bg-white px-4 text-[18px] font-normal leading-[22px] text-ink outline-none placeholder:text-muted focus:border-primary"
                />
              </div>

              <div className="flex min-h-[18px] items-center gap-2">
                {resolved ? (
                  <>
                    <CircleCheckIcon className="h-[18px] w-[18px] flex-none text-[#43814C]" />
                    <span className="text-[14px] font-semibold leading-[17px] text-[#43814C]">
                      {resolved.name}
                    </span>
                    <span className="text-[14px] font-normal leading-[17px] text-muted">
                      Account verified
                    </span>
                  </>
                ) : (
                  <span className="text-[14px] font-normal leading-[17px] text-muted">
                    Enter the recipient&apos;s account number to verify.
                  </span>
                )}
              </div>
            </div>

            <Divider />

            <div className="flex flex-none flex-col gap-2">
              <label
                htmlFor="transfer-amount"
                className="text-[16px] font-semibold leading-[19px] text-ink"
              >
                Amount
              </label>
              <OutlinedAmountBox
                id="transfer-amount"
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
                <span className="text-muted">Minimum transfer: ₱1.00</span>
                <span className={amountError ? 'text-red-600' : 'font-semibold text-primary'}>
                  {amountError ?? 'No transfer fee'}
                </span>
              </div>
            </div>

            <div className="flex flex-none flex-col gap-2">
              <label
                htmlFor="transfer-note"
                className="text-[16px] font-semibold leading-[19px] text-ink"
              >
                Note (optional)
              </label>
              <input
                id="transfer-note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                className="h-[52px] w-full rounded-[16px] border border-[#E8E0D8] bg-white px-4 text-[18px] font-normal leading-[22px] text-ink outline-none placeholder:text-muted focus:border-primary"
              />
            </div>

            <label className="flex w-fit cursor-pointer items-center gap-2.5">
              <input
                type="checkbox"
                checked={saveRecipient}
                onChange={(event) => setSaveRecipient(event.target.checked)}
                className="h-5 w-5 flex-none rounded-[6px] border border-[#E8E0D8] accent-primary"
              />
              <span className="text-[15px] font-normal leading-[18px] text-[#6E6168]">
                Save this recipient for next time
              </span>
            </label>
          </DetailsCard>

          <ReviewPanel>
            <ReviewHeading
              title="Review"
              description="Make sure everything looks right before sending."
            />

            <ReviewSummary
              initials={initialsFor(resolved?.name)}
              name={recipientName}
              detail={bankLine}
            />

            <Divider />

            <div className="flex flex-none flex-col gap-5">
              <ReviewRow label="Amount" value={formatCurrency(parsedAmount)} />
              <ReviewRow label="Transfer fee" value="₱0.00" />
              <ReviewRow label="When" value="Send now" />
              <ReviewRow label="Arrival" value="Instant" />
            </div>

            <ReviewTotal
              label="Total to send"
              amount={formatCurrency(parsedAmount)}
              note={`Balance after transfer: ${formatCurrency(balance - parsedAmount)}`}
            />

            <div className="mt-auto flex flex-none flex-col gap-4">
              <p className="text-[14px] font-normal leading-[17px] text-[#6E6168]">
                Please check the account number. Transfers cannot be reversed.
              </p>
              <SubmitButton
                label={`Send ${formatCurrency(parsedAmount)}`}
                disabled={status === 'loading'}
              />
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

export default TransferPage;