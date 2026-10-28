import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { ApiError } from '@/api/client';
import { createTransfer } from '@/api/transactions';
import { listBeneficiaries } from '@/api/beneficiaries';
import type { Beneficiary } from '@/api/beneficiaries';
import AccountSelect from '@/components/dashboard/AccountSelect';
import AmountField from '@/components/dashboard/AmountField';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import Select from '@/components/common/Select';
import Input from '@/components/common/Input';
import Button from '@/components/common/Button';
import { useAccounts } from '@/context/AccountContext';
import { formatCurrency, maskAccountNumber } from '@/utils/format';

type Status = 'idle' | 'loading' | 'success' | 'error';
type Mode = 'internal' | 'external';

const TransferPage = () => {
  const { accounts, selectedAccount, refresh } = useAccounts();
  const [sourceId, setSourceId] = useState('');
  const [mode, setMode] = useState<Mode>('internal');
  const [destinationId, setDestinationId] = useState('');
  const [beneficiaryId, setBeneficiaryId] = useState('');
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState<string>();
  const controllerRef = useRef<AbortController>();

  useEffect(() => {
    if (!sourceId && selectedAccount) setSourceId(selectedAccount.id);
  }, [sourceId, selectedAccount]);

  useEffect(() => {
    const controller = new AbortController();
    controllerRef.current = controller;
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
  const destinationAccount = accounts.find((item) => item.id === destinationId);
  const beneficiary = beneficiaries.find((item) => item.id === beneficiaryId);
  const parsedAmount = Number(amount);

  const amountError = (() => {
    if (!amount || Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      return amount ? 'Enter an amount greater than zero.' : undefined;
    }
    if (sourceAccount && sourceAccount.type === 'savings' && parsedAmount > sourceAccount.balance) {
      return 'Insufficient funds. Savings accounts cannot be overdrawn.';
    }
    if (sourceAccount && parsedAmount > sourceAccount.balance + (sourceAccount.overdraftLimit ?? 0)) {
      return 'Amount exceeds your available balance.';
    }
    return undefined;
  })();

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!sourceId || !amount || amountError) {
      setStatus('error');
      setMessage(amountError ?? 'Choose a source account and enter a valid amount.');
      return;
    }
    if (mode === 'internal' && (!destinationId || destinationId === sourceId)) {
      setStatus('error');
      setMessage('Choose a different destination account.');
      return;
    }
    if (mode === 'external' && !beneficiaryId) {
      setStatus('error');
      setMessage('Choose a recipient.');
      return;
    }

    setStatus('loading');
    setMessage(undefined);
    try {
      await createTransfer({
        sourceAccountId: sourceId,
        amount: parsedAmount,
        note: note.trim() || undefined,
        destinationAccountId: mode === 'internal' ? destinationId : undefined,
        beneficiaryId: mode === 'external' ? beneficiaryId : undefined,
      });
      await refresh();
      setStatus('success');
      setMessage(`${formatCurrency(parsedAmount, sourceAccount?.currency)} transferred successfully.`);
      setAmount('');
      setNote('');
      setDestinationId('');
      setBeneficiaryId('');
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof ApiError ? err.message : 'Transfer failed. Please try again.');
    }
  };

  const destinationLabel = (() => {
    if (mode === 'internal') return destinationAccount?.label ?? '—';
    return beneficiary?.name ?? '—';
  })();

  return (
    <DashboardLayout title="Transfer">
      <div className="flex flex-1 flex-col gap-6 pb-2 lg:flex-row lg:overflow-hidden">
        <form
          onSubmit={handleSubmit}
          className="flex flex-1 flex-col gap-5 rounded-[28px] border border-surface-line bg-surface-soft p-5 sm:p-8 lg:overflow-y-auto"
        >
          <AccountSelect
            label="From account"
            accounts={accounts}
            value={sourceId}
            onChange={setSourceId}
            helper="The account funds will be taken from."
          />

          <div className="flex flex-col gap-2">
            <span className="text-[14px] font-medium leading-[1.21] text-ink">Send to</span>
            <div role="tablist" aria-label="Transfer destination" className="flex gap-3">
              {(['internal', 'external'] as Mode[]).map((value) => {
                const active = value === mode;
                return (
                  <button
                    key={value}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setMode(value)}
                    className={`h-11 flex-1 rounded-full border text-[14px] font-semibold transition-colors ${
                      active
                        ? 'border-primary bg-surface-card text-ink'
                        : 'border-surface-line bg-white text-muted hover:border-primary/60'
                    }`}
                  >
                    {value === 'internal' ? 'My accounts' : 'Others'}
                  </button>
                );
              })}
            </div>
          </div>

          {mode === 'internal' ? (
            <AccountSelect
              label="Destination account"
              accounts={accounts}
              value={destinationId}
              onChange={setDestinationId}
              excludeId={sourceId}
              placeholder="Choose one of your accounts"
            />
          ) : (
            <label className="flex flex-col gap-2">
              <span className="text-[14px] font-medium leading-[1.21] text-ink">Recipient</span>
              <Select value={beneficiaryId} onChange={(event) => setBeneficiaryId(event.target.value)}>
                <option value="">Select a recipient</option>
                {beneficiaries.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} · {maskAccountNumber(item.accountNumber)}
                  </option>
                ))}
              </Select>
              {beneficiaries.length === 0 && (
                <span className="text-[12px] leading-[1.21] text-muted">
                  No saved recipients yet.
                </span>
              )}
            </label>
          )}

          <AmountField value={amount} onChange={setAmount} error={amountError} helper="Amount to send." />
          <label className="flex flex-col gap-2">
            <span className="text-[14px] font-medium leading-[1.21] text-ink">Note (optional)</span>
            <Input value={note} onChange={(event) => setNote(event.target.value)} placeholder="e.g. Shared bill" />
          </label>

          <div className="mt-2 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-4">
            <Button
              type="submit"
              variant="primary"
              disabled={status === 'loading'}
              className="h-[52px] px-8 text-[16px] font-semibold"
            >
              {status === 'loading' ? 'Processing…' : 'Review transfer'}
            </Button>
            {message && (
              <span
                role="status"
                className={`text-[13px] leading-[1.21] ${status === 'error' ? 'text-red-600' : 'text-emerald-600'}`}
              >
                {message}
              </span>
            )}
          </div>
        </form>

        <aside className="flex w-full flex-none flex-col gap-5 rounded-[28px] bg-[rgba(248,231,185,0.32)] p-5 sm:p-8 lg:w-[350px]">
          <h2 className="text-[18px] font-semibold leading-[1.21] text-ink">Transfer summary</h2>
          <dl className="flex flex-col gap-3 text-[14px] leading-[1.21]">
            <div className="flex items-center justify-between">
              <dt className="text-muted">From</dt>
              <dd className="font-medium text-ink">{sourceAccount?.label ?? '—'}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted">To</dt>
              <dd className="font-medium text-ink">{destinationLabel}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted">Amount</dt>
              <dd className="font-medium text-ink">{amount ? formatCurrency(parsedAmount || 0, sourceAccount?.currency) : '—'}</dd>
            </div>
          </dl>
          <div className="mt-auto rounded-[20px] bg-white p-4">
            <p className="text-[13px] text-muted">Available balance</p>
            <p className="mt-1 text-[24px] font-bold leading-[1.21] text-ink">
              {sourceAccount ? formatCurrency(sourceAccount.balance, sourceAccount.currency) : '—'}
            </p>
          </div>
        </aside>
      </div>
    </DashboardLayout>
  );
};

export default TransferPage;
