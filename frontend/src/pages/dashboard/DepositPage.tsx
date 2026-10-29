import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { ApiError } from '@/api/client';
import { createTransaction } from '@/api/transactions';
import type { Transaction } from '@/api/transactions';
import AccountSelect from '@/components/dashboard/AccountSelect';
import AmountField from '@/components/dashboard/AmountField';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import ReceiptModal from '@/components/dashboard/ReceiptModal';
import Input from '@/components/common/Input';
import Button from '@/components/common/Button';
import { useAccounts } from '@/context/AccountContext';
import { formatCurrency } from '@/utils/format';

type Status = 'idle' | 'loading' | 'success' | 'error';

const DepositPage = () => {
  const { accounts, selectedAccount, refresh } = useAccounts();
  const [accountId, setAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState<string>();
  const [receipt, setReceipt] = useState<Transaction | null>(null);

  useEffect(() => {
    if (!accountId && selectedAccount) setAccountId(selectedAccount.id);
  }, [accountId, selectedAccount]);

  const account = accounts.find((item) => item.id === accountId);
  const parsedAmount = Number(amount);
  const amountError =
    amount && (Number.isNaN(parsedAmount) || parsedAmount <= 0) ? 'Enter an amount greater than zero.' : undefined;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!accountId || !amount || amountError) {
      setStatus('error');
      setMessage('Choose an account and enter a valid amount.');
      return;
    }

    setStatus('loading');
    setMessage(undefined);
    try {
      const transaction = await createTransaction({
        accountId,
        type: 'deposit',
        amount: parsedAmount,
        note: note.trim() || undefined,
      });
      await refresh();
      setStatus('success');
      setMessage(`${formatCurrency(parsedAmount, account?.currency)} deposited successfully.`);
      setReceipt(transaction);
      setAmount('');
      setNote('');
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof ApiError ? err.message : 'Deposit failed. Please try again.');
    }
  };

  return (
    <DashboardLayout title="Deposit">
      <div className="flex flex-1 flex-col gap-6 pb-2 lg:flex-row lg:overflow-hidden">
        <form
          onSubmit={handleSubmit}
          className="flex flex-1 flex-col gap-5 rounded-[28px] border border-surface-line bg-surface-soft p-5 sm:p-8 lg:overflow-y-auto"
        >
          <AccountSelect
            label="Deposit to"
            accounts={accounts}
            value={accountId}
            onChange={setAccountId}
            helper="Funds will be added to this account."
          />
          <AmountField
            value={amount}
            onChange={setAmount}
            error={amountError}
            helper="Enter the amount you want to add."
          />
          <label className="flex flex-col gap-2">
            <span className="text-[14px] font-medium leading-[1.21] text-ink">Note (optional)</span>
            <Input value={note} onChange={(event) => setNote(event.target.value)} placeholder="e.g. Payroll" />
          </label>

          <div className="mt-2 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-4">
            <Button
              type="submit"
              variant="primary"
              disabled={status === 'loading'}
              className="h-[52px] px-8 text-[16px] font-semibold"
            >
              {status === 'loading' ? 'Processing…' : 'Confirm deposit'}
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
          <h2 className="text-[18px] font-semibold leading-[1.21] text-ink">Deposit summary</h2>
          <dl className="flex flex-col gap-3 text-[14px] leading-[1.21]">
            <div className="flex items-center justify-between">
              <dt className="text-muted">Account</dt>
              <dd className="font-medium text-ink">{account?.label ?? '—'}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted">Amount</dt>
              <dd className="font-medium text-ink">{amount ? formatCurrency(parsedAmount || 0, account?.currency) : '—'}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted">Note</dt>
              <dd className="max-w-[160px] truncate text-right font-medium text-ink">{note || '—'}</dd>
            </div>
          </dl>
          <div className="mt-auto rounded-[20px] bg-white p-4">
            <p className="text-[13px] text-muted">Available balance</p>
            <p className="mt-1 text-[24px] font-bold leading-[1.21] text-ink">
              {account ? formatCurrency(account.balance, account.currency) : '—'}
            </p>
          </div>
        </aside>
      </div>
      {receipt && (
        <ReceiptModal transaction={receipt} account={account} onClose={() => setReceipt(null)} />
      )}
    </DashboardLayout>
  );
};

export default DepositPage;
