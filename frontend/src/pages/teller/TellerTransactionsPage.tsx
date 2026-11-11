import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { ApiError } from '@/api/client';
import {
  getTellerAccount,
  listTellerAccountTransactions,
  listTellerTransactions,
  processTellerTransaction,
} from '@/api/teller';
import type { TellerCustomer, TellerTransactionsResponse } from '@/api/teller';
import type { Account } from '@/api/accounts';
import type { Transaction } from '@/api/transactions';
import ReceiptModal from '@/components/dashboard/ReceiptModal';
import TellerCustomerSearch from '@/components/teller/TellerCustomerSearch';
import TellerHeader from '@/components/teller/TellerHeader';
import usePolling from '@/hooks/usePolling';
import { useToast } from '@/components/common/Toast';
import { formatAccountNumber, formatCurrency, formatDateTime } from '@/utils/format';

const accountStatusTone: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-700',
  frozen: 'bg-amber-50 text-amber-700',
  closed: 'bg-gray-100 text-gray-600',
};

const transactionTone: Record<string, string> = {
  deposit: 'bg-emerald-50 text-emerald-700',
  withdraw: 'bg-amber-50 text-amber-700',
  transfer: 'bg-surface-card text-primary',
};

const TellerTransactionsPage = () => {
  const [customer, setCustomer] = useState<TellerCustomer>();
  const [account, setAccount] = useState<Account>();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [recent, setRecent] = useState<TellerTransactionsResponse>();
  const [loadingRecent, setLoadingRecent] = useState(true);

  const [type, setType] = useState<'deposit' | 'withdraw'>('deposit');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState<{ transaction: Transaction; account?: Account }>();

  const [error, setError] = useState<string>();
  const toast = useToast();

  const refreshRecent = async (silent = false) => {
    if (!silent) setLoadingRecent(true);
    try {
      setRecent(await listTellerTransactions({ limit: 50 }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to load your recent transactions.');
    } finally {
      setLoadingRecent(false);
    }
  };

  useEffect(() => {
    void refreshRecent();
  }, []);

  usePolling(() => { void refreshRecent(true); });

  const viewReceipt = async (transaction: Transaction) => {
    try {
      const customer = await getTellerAccount(transaction.accountId);
      const account = customer.accounts.find((item) => item.id === transaction.accountId);
      setReceipt({ transaction, account });
    } catch {
      setReceipt({ transaction });
    }
  };

  const selectCustomer = (next: TellerCustomer) => {
    setCustomer(next);
    setAccount(undefined);
    setTransactions([]);
    setError(undefined);
  };

  const selectAccount = async (next: Account) => {
    setAccount(next);
    setTransactions([]);
    setError(undefined);
    setLoadingHistory(true);
    try {
      setTransactions(await listTellerAccountTransactions(next.id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to load this account history.');
    } finally {
      setLoadingHistory(false);
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!account) return;
    setSubmitting(true);
    setError(undefined);
    try {
      const created = await processTellerTransaction({
        accountId: account.id,
        type,
        amount: Number(amount),
        note: note.trim() || undefined,
      });
      setReceipt({ transaction: created, account });
      toast.success(
        `${type === 'deposit' ? 'Deposit' : 'Withdrawal'} of ${formatCurrency(created.amount, created.currency)} processed.`,
      );
      setAmount('');
      setNote('');
      void refreshRecent();

      // Refresh balances and history; a refresh failure should not hide the
      // fact that the transaction already went through.
      try {
        const refreshed = await getTellerAccount(account.id);
        const updated = refreshed.accounts.find((item) => item.id === account.id) ?? account;
        setCustomer(refreshed);
        setAccount(updated);
        setReceipt({ transaction: created, account: updated });
        setTransactions(await listTellerAccountTransactions(account.id));
      } catch {
        // Keep the processed receipt and stale balances on screen.
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Unable to process this transaction.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="flex flex-col gap-6">
      <TellerHeader
        title="Transactions"
      />

      <TellerCustomerSearch selectedId={customer?.customerId} onSelect={selectCustomer} />

      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}

      {!customer ? (
        <p className="rounded-[24px] border border-dashed border-surface-line bg-white p-6 text-sm text-muted">
          Select a customer to begin a transaction.
        </p>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-[24px] border border-surface-line bg-white p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-[18px] font-semibold">{customer.name}</h2>
                <p className="mt-1 text-sm text-muted">{customer.email}</p>
                <p className="mt-1 text-sm text-muted">{customer.phone ?? 'No phone on file'}</p>
              </div>
              <span className="rounded-full bg-surface-soft px-3 py-1 text-xs font-semibold capitalize text-muted">
                {customer.status}
              </span>
            </div>

            <h3 className="mt-5 text-sm font-semibold text-muted">Select an account</h3>
            <ul className="mt-2 grid gap-2">
              {customer.accounts.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => void selectAccount(item)}
                    className={`w-full rounded-xl border px-4 py-3 text-left transition-colors ${
                      account?.id === item.id
                        ? 'border-primary bg-surface-card'
                        : 'border-surface-line hover:bg-surface-card/60'
                    }`}
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold">{item.label}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${
                          accountStatusTone[item.status] ?? 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {item.status}
                      </span>
                    </span>
                    <span className="mt-0.5 block font-mono text-xs text-muted">
                      {formatAccountNumber(item.accountNumber)}
                    </span>
                    <span className="mt-1 block text-sm font-semibold">
                      {formatCurrency(item.balance, item.currency)}
                    </span>
                  </button>
                </li>
              ))}
              {customer.accounts.length === 0 && (
                <li className="rounded-xl border border-dashed border-surface-line px-4 py-6 text-center text-sm text-muted">
                  This customer has no accounts.
                </li>
              )}
            </ul>
          </section>

          <section className="rounded-[24px] border border-surface-line bg-white p-5 sm:p-6">
            <h2 className="text-[18px] font-semibold">Process transaction</h2>
            {!account ? (
              <p className="mt-3 text-sm text-muted">Choose an account to continue.</p>
            ) : account.status !== 'active' ? (
              <p className="mt-3 text-sm text-red-700">
                This account is {account.status}. Transactions can only be processed on active accounts.
              </p>
            ) : (
              <form className="mt-4 flex flex-col gap-4" onSubmit={submit}>
                <label className="flex flex-col gap-2">
                  <span className="text-sm font-medium">Type</span>
                  <select
                    value={type}
                    onChange={(event) => setType(event.target.value as 'deposit' | 'withdraw')}
                    className="h-[43px] rounded-xl border border-surface-line bg-white px-3 outline-none focus:border-primary"
                  >
                    <option value="deposit">Deposit</option>
                    <option value="withdraw">Withdrawal</option>
                  </select>
                </label>
                <label className="flex flex-col gap-2">
                  <span className="text-sm font-medium">Amount</span>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    required
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    placeholder="0.00"
                    className="h-[43px] rounded-xl border border-surface-line bg-white px-4 outline-none focus:border-primary"
                  />
                </label>
                <label className="flex flex-col gap-2">
                  <span className="text-sm font-medium">Note (optional)</span>
                  <textarea
                    maxLength={255}
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    className="min-h-20 rounded-xl border border-surface-line bg-white p-3 outline-none focus:border-primary"
                  />
                </label>
                <button
                  type="submit"
                  disabled={submitting}
                  className="h-11 rounded-xl bg-primary font-semibold text-ink disabled:opacity-50"
                >
                  {submitting ? 'Processing…' : `Process ${type === 'deposit' ? 'deposit' : 'withdrawal'}`}
                </button>
              </form>
            )}
          </section>
        </div>
      )}

      {account && (
        <section className="rounded-[24px] border border-surface-line bg-white p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-[18px] font-semibold">
              Recent activity · {account.label} {formatAccountNumber(account.accountNumber)}
            </h2>
            <span className="text-sm text-muted">Last 50 transactions</span>
          </div>

          {loadingHistory ? (
            <p role="status" className="py-6 text-sm text-muted">Loading transactions…</p>
          ) : transactions.length === 0 ? (
            <p className="py-6 text-sm text-muted">No transactions on this account yet.</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="bg-surface-soft text-[12px] uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Type</th>
                    <th className="px-4 py-3 text-right font-medium">Amount</th>
                    <th className="px-4 py-3 text-right font-medium">Balance after</th>
                    <th className="px-4 py-3 font-medium">Reference</th>
                    <th className="px-4 py-3 font-medium">Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-line">
                  {transactions.map((tx) => (
                    <tr key={tx.id}>
                      <td className="px-4 py-3 text-muted">{formatDateTime(tx.createdAt)}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold capitalize ${
                            transactionTone[tx.type] ?? 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {tx.type === 'withdraw' ? 'withdrawal' : tx.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">
                        {formatCurrency(tx.amount, tx.currency)}
                      </td>
                      <td className="px-4 py-3 text-right text-muted">
                        {typeof tx.balanceAfter === 'number'
                          ? formatCurrency(tx.balanceAfter, tx.currency)
                          : '—'}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">{tx.reference}</td>
                      <td className="px-4 py-3 text-muted">{tx.note ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <section className="overflow-hidden rounded-[28px] border border-surface-line bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-6">
          <h2 className="text-[18px] font-semibold leading-[1.21]">My recent transactions</h2>
          <span className="text-sm text-muted">Last 50 transactions you processed</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left">
            <thead className="bg-surface-soft text-[12px] uppercase tracking-wide text-muted">
              <tr>
                <th className="px-5 py-3 font-medium sm:px-6">Date</th>
                <th className="px-5 py-3 font-medium sm:px-6">Customer</th>
                <th className="px-5 py-3 font-medium sm:px-6">Account</th>
                <th className="px-5 py-3 font-medium sm:px-6">Type</th>
                <th className="px-5 py-3 text-right font-medium sm:px-6">Amount</th>
                <th className="px-5 py-3 font-medium sm:px-6">Reference</th>
                <th className="px-5 py-3 font-medium sm:px-6">Status</th>
                <th className="px-5 py-3 text-right font-medium sm:px-6">Receipt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-line">
              {(recent?.items ?? []).map((tx) => (
                <tr key={tx.id}>
                  <td className="px-5 py-4 text-sm text-muted sm:px-6">
                    {tx.createdAt ? formatDateTime(tx.createdAt) : '—'}
                  </td>
                  <td className="px-5 py-4 text-sm font-semibold sm:px-6">{tx.customerName ?? '—'}</td>
                  <td className="px-5 py-4 text-sm text-muted sm:px-6">
                    {tx.accountLabel ?? 'Account'} · {tx.accountNumber ?? '—'}
                  </td>
                  <td className="px-5 py-4 sm:px-6">
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold capitalize ${transactionTone[tx.type] ?? 'bg-gray-100 text-gray-600'}`}>
                      {tx.type === 'withdraw' ? 'withdrawal' : tx.type}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right text-sm font-semibold sm:px-6">
                    {formatCurrency(tx.amount, tx.currency)}
                  </td>
                  <td className="px-5 py-4 font-mono text-xs sm:px-6">{tx.reference}</td>
                  <td className="px-5 py-4 text-sm capitalize text-muted sm:px-6">{tx.status}</td>
                  <td className="px-5 py-4 text-right sm:px-6">
                    <button
                      type="button"
                      onClick={() => void viewReceipt(tx)}
                      className="rounded-lg border border-surface-line px-3 py-1.5 text-sm font-medium hover:bg-surface-card"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
              {(recent?.items.length ?? 0) === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-8 text-center text-sm text-muted">
                    {loadingRecent ? 'Loading transactions…' : 'You have not processed any transactions yet.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {receipt && (
        <ReceiptModal
          transaction={receipt.transaction}
          account={receipt.account}
          onClose={() => setReceipt(undefined)}
        />
      )}
    </section>
  );
};

export default TellerTransactionsPage;
