import { useState } from 'react';
import type { FormEvent } from 'react';
import { ApiError } from '@/api/client';
import { createAccount } from '@/api/accounts';
import type { AccountType } from '@/api/accounts';
import Button from '@/components/common/Button';
import Input from '@/components/common/Input';
import AmountField from '@/components/dashboard/AmountField';
import CircleCheckIcon from '@/components/icons/CircleCheckIcon';
import PlusIcon from '@/components/icons/PlusIcon';
import { useAccounts } from '@/context/AccountContext';
import { formatCurrency } from '@/utils/format';

type Status = 'idle' | 'loading' | 'success' | 'error';
type Step = 0 | 1 | 2;

const MIN_SAVINGS_DEPOSIT = 100;
const SAVINGS_INTEREST_RATE = 0.03;
const SAVINGS_MONTHLY_WITHDRAWALS = 10;
const CHECKING_OVERDRAFT_LIMIT = 10000;

interface TypeOption {
  value: AccountType;
  title: string;
  highlights: string[];
}

const typeOptions: TypeOption[] = [
  {
    value: 'savings',
    title: 'Savings',
    highlights: [
      `Earns ${(SAVINGS_INTEREST_RATE * 100).toFixed(2)}% interest per year`,
      `${formatCurrency(MIN_SAVINGS_DEPOSIT)} minimum maintaining balance`,
      `Up to ${SAVINGS_MONTHLY_WITHDRAWALS} free withdrawals per month`,
      'Overdraft is not allowed',
    ],
  },
  {
    value: 'checking',
    title: 'Checking',
    highlights: [
      'No interest earned',
      'No minimum maintaining balance',
      'Unlimited transactions',
      `Overdraft protection up to ${formatCurrency(CHECKING_OVERDRAFT_LIMIT)}`,
    ],
  },
];

const steps = ['Choose account', 'Account details', 'Review'];

const OpenAccountForm = () => {
  const { accounts, refresh } = useAccounts();
  const [step, setStep] = useState<Step>(0);
  const [type, setType] = useState<AccountType>('savings');
  const [label, setLabel] = useState('');
  const [initialDeposit, setInitialDeposit] = useState('');
  const [makePrimary, setMakePrimary] = useState(false);
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState<string>();

  const activeOption = typeOptions.find((option) => option.value === type)!;
  const hasPrimary = accounts.some((account) => account.isPrimary);
  const parsedDeposit = Number(initialDeposit);
  let depositError: string | undefined;
  if (initialDeposit) {
    if (Number.isNaN(parsedDeposit) || parsedDeposit <= 0) {
      depositError = 'Enter an amount greater than zero.';
    } else if (type === 'savings' && parsedDeposit < MIN_SAVINGS_DEPOSIT) {
      depositError = `Savings accounts require at least ${formatCurrency(MIN_SAVINGS_DEPOSIT)} to open.`;
    }
  }

  const depositHelper =
    type === 'savings'
      ? `Optional. Minimum ${formatCurrency(MIN_SAVINGS_DEPOSIT)} to open a savings account.`
      : 'Optional. You can also fund the account later.';

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (step < 2) {
      if (step === 1 && depositError) {
        setStatus('error');
        setMessage('Please fix the highlighted field.');
        return;
      }
      setStatus('idle');
      setMessage(undefined);
      setStep((current) => (current + 1) as Step);
      return;
    }
    if (depositError) {
      setStep(1);
      setStatus('error');
      setMessage('Please fix the highlighted field.');
      return;
    }

    setStatus('loading');
    setMessage(undefined);

    try {
      const account = await createAccount({
        type,
        label: label.trim() || undefined,
        initialDeposit: initialDeposit ? parsedDeposit : undefined,
        isPrimary: makePrimary || undefined,
      });
      setStatus('success');
      setMessage(`${account.label} opened successfully.`);
      setStep(0);
      setLabel('');
      setInitialDeposit('');
      setMakePrimary(false);
      await refresh();
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof ApiError ? error.message : 'Something went wrong. Please try again.');
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex min-h-[470px] flex-col gap-5 rounded-[28px] border border-surface-line bg-surface-soft p-6"
    >
      <div className="flex items-start justify-between gap-6">
        <div className="flex flex-col gap-1">
          <h3 className="text-[18px] font-semibold leading-[1.21] text-ink">Open a new account</h3>
          <p className="text-[13px] leading-[1.4] text-muted"></p>
        </div>
        <span className="shrink-0 text-[13px] font-medium text-muted">Step {step + 1} of {steps.length}</span>
      </div>

      <div className="flex items-center gap-2" aria-label="Account setup progress">
        {steps.map((title, index) => (
          <div key={title} className="flex min-w-0 flex-1 flex-col gap-2">
            <div className={`h-1.5 rounded-full ${index <= step ? 'bg-primary' : 'bg-surface-line'}`} />
            <span className={`truncate text-[12px] ${index === step ? 'font-semibold text-ink' : 'text-muted'}`}>
              {title}
            </span>
          </div>
        ))}
      </div>

      <div className="flex flex-1 flex-col gap-4" aria-live="polite">
        {step === 0 && (
          <>
            <p className="text-[14px] font-medium text-ink">Choose the account that fits your needs.</p>
            <div role="radiogroup" aria-label="Account type" className="grid grid-cols-2 gap-3">
              {typeOptions.map((option) => {
                const active = option.value === type;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setType(option.value)}
                    className={`flex flex-col gap-1.5 rounded-[20px] border p-4 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-hover ${
                      active ? 'border-primary bg-surface-card' : 'border-surface-line bg-white hover:border-primary/60'
                    }`}
                  >
                    <span className="text-[18px] font-semibold leading-[1.21] text-ink">{option.title}</span>
                    <span className="text-[12px] leading-[1.4] text-muted">
                      {option.value === 'savings' }
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="flex flex-col gap-2 rounded-[20px] border border-surface-line bg-surface-card p-4">
              <p className="text-[13px] font-semibold leading-[1.21] text-ink">
                What {activeOption.title.toLowerCase()} gives you
              </p>
              <ul className="grid grid-cols-2 gap-x-5 gap-y-2">
                {activeOption.highlights.map((highlight) => (
                  <li key={highlight} className="flex items-center gap-2 text-[13px] leading-[1.3] text-muted">
                    <CircleCheckIcon className="h-3.5 w-3.5 shrink-0 text-primary" />
                    {highlight}
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <div className="rounded-[20px] border border-surface-line bg-surface-card p-4">
              <p className="text-[13px] text-muted">Account type</p>
              <p className="mt-1 text-[18px] font-semibold text-ink">{activeOption.title}</p>
            </div>
            <label className="flex flex-col gap-2">
              <span className="text-[14px] font-medium leading-[1.21] text-ink">Account label (optional)</span>
              <Input
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                placeholder="e.g. Emergency fund"
                maxLength={40}
              />
            </label>
            <AmountField
              value={initialDeposit}
              onChange={setInitialDeposit}
              error={depositError}
              helper={depositHelper}
            />
          </>
        )}

        {step === 2 && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-[20px] border border-surface-line bg-surface-card p-4">
                <p className="text-[13px] text-muted">Account type</p>
                <p className="mt-1 text-[18px] font-semibold text-ink">{activeOption.title}</p>
              </div>
              <div className="rounded-[20px] border border-surface-line bg-surface-card p-4">
                <p className="text-[13px] text-muted">Opening deposit</p>
                <p className="mt-1 text-[18px] font-semibold text-ink">
                  {initialDeposit ? formatCurrency(parsedDeposit) : 'No deposit'}
                </p>
              </div>
            </div>
            <div className="rounded-[20px] border border-surface-line bg-surface-card p-4">
              <p className="text-[13px] text-muted">Account label</p>
              <p className="mt-1 text-[16px] font-semibold text-ink">{label.trim() || activeOption.title}</p>
            </div>
            <label className="flex items-start gap-3 rounded-[20px] bg-white p-4">
              <input
                type="checkbox"
                checked={makePrimary}
                onChange={(event) => setMakePrimary(event.target.checked)}
                className="mt-0.5 h-5 w-5 cursor-pointer accent-primary"
              />
              <span className="flex flex-col gap-0.5">
                <span className="text-[14px] font-medium leading-[1.21] text-ink">Set as my primary account</span>
                <span className="text-[12px] leading-[1.3] text-muted">
                  {hasPrimary ? 'This will replace your current primary account.' : 'This will become your primary account.'}
                </span>
              </span>
            </label>
          </>
        )}
      </div>

      <div className="flex min-h-12 items-center justify-between gap-4 border-t border-surface-line pt-4">
        <div>
          {step > 0 && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => { setStep((current) => (current - 1) as Step); setStatus('idle'); setMessage(undefined); }}
              className="h-[48px] px-6 text-[15px] font-semibold"
            >
              Back
            </Button>
          )}
        </div>
        <div className="flex items-center gap-4">
          {message && (
            <span role="status" className={`text-[13px] leading-[1.21] ${status === 'error' ? 'text-red-600' : 'text-emerald-600'}`}>
              {message}
            </span>
          )}
          <Button
            type="submit"
            variant="primary"
            disabled={status === 'loading'}
            className="h-[48px] gap-2 px-6 text-[15px] font-semibold"
          >
            {step === 2 ? <PlusIcon className="h-5 w-5" /> : null}
            {status === 'loading' ? 'Opening…' : step === 2 ? 'Open account' : 'Continue'}
          </Button>
        </div>
      </div>
    </form>
  );
};

export default OpenAccountForm;
