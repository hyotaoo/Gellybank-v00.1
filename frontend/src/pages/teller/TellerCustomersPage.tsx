import { useState } from 'react';
import { ApiError } from '@/api/client';
import { listTellerAccountTransactions } from '@/api/teller';
import type { TellerCustomer } from '@/api/teller';
import type { Account } from '@/api/accounts';
import type { Transaction } from '@/api/transactions';
import TellerCustomerSearch from '@/components/teller/TellerCustomerSearch';
import TellerHeader from '@/components/teller/TellerHeader';
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

const TellerCustomersPage = () => {
  const [customer, setCustomer] = useState<TellerCustomer>();
  const [account, setAccount] = useState<Account>();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [error, setError] = useState<string>();

  const selectCustomer = (next: TellerCustomer) => {
    setCustomer(next);
    setAccount(undefined);
    setTransactions([]);
    setError(undefined);
  };

  const viewHistory = async (next: Account) => {
    setAccount(next);
    setTransactions([]);
    setLoadingHistory(true);
    setError(undefined);
    try {
      setTransactions(await listTellerAccountTransactions(next.id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to load this account history.');
    } finally {
      setLoadingHistory(false);
    }
  };

  return (
    <section className="flex flex-col gap-6">
      <TellerHeader
        title="Customers"
      />

      <TellerCustomerSearch
        selectedId={customer?.customerId}
        onSelect={selectCustomer}
      />

      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}

      {!customer ? (
        <p className="rounded-[24px] border border-dashed border-surface-line bg-white p-6 text-sm text-muted">
          Select a customer to view their profile and accounts.
        </p>
      ) : (
        <>
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

            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="bg-surface-soft text-[12px] uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-4 py-3 font-medium">Account</th>
                    <th className="px-4 py-3 font-medium">Type</th>
                    <th className="px-4 py-3 text-right font-medium">Balance</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 text-right font-medium">History</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-line">
                  {customer.accounts.map((item) => (
                    <tr key={item.id} className={account?.id === item.id ? 'bg-surface-card/40' : ''}>
                      <td className="px-4 py-3 font-mono text-xs">{formatAccountNumber(item.accountNumber)}</td>
                      <td className="px-4 py-3 capitalize">{item.label}</td>
                      <td className="px-4 py-3 text-right font-semibold">
                        {formatCurrency(item.balance, item.currency)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold capitalize ${
                            accountStatusTone[item.status] ?? 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {item.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => void viewHistory(item)}
                          className="rounded-lg border border-surface-line px-3 py-1.5 text-xs font-semibold hover:bg-surface-card"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                  {customer.accounts.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-sm text-muted">
                        This customer has no accounts.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {account && (
            <section className="rounded-[24px] border border-surface-line bg-white p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-[18px] font-semibold">
                  History · {account.label} {formatAccountNumber(account.accountNumber)}
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
        </>
      )}
    </section>
  );
};

export default TellerCustomersPage;
