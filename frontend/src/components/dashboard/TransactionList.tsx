import { useEffect, useRef, useState } from 'react';
import { ApiError } from '@/api/client';
import { listTransactions } from '@/api/transactions';
import type { Transaction } from '@/api/transactions';
import ReceiptModal from '@/components/dashboard/ReceiptModal';
import DepositIcon from '@/components/icons/DepositIcon';
import HistoryIcon from '@/components/icons/HistoryIcon';
import TransferIcon from '@/components/icons/TransferIcon';
import WithdrawIcon from '@/components/icons/WithdrawIcon';
import { useAccounts } from '@/context/AccountContext';
import { formatCurrency, formatDateTime } from '@/utils/format';

interface TransactionListProps {
  accountId: string | null;
  currency?: string;
  limit?: number;
  className?: string;
}

const typeIcon = {
  deposit: <DepositIcon className="h-5 w-5" />,
  withdraw: <WithdrawIcon className="h-5 w-5" />,
  transfer: <TransferIcon className="h-5 w-5" />,
};

const statusTone: Record<Transaction['status'], string> = {
  completed: 'text-emerald-600',
  pending: 'text-amber-600',
  failed: 'text-red-600',
  void: 'text-muted',
};

const TransactionList = ({ accountId, currency, limit, className = '' }: TransactionListProps) => {
  const { accounts } = useAccounts();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [receipt, setReceipt] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController>();

  useEffect(() => {
    if (!accountId) {
      setTransactions([]);
      return;
    }

    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    setLoading(true);
    setError(null);

    listTransactions({ accountId, limit }, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setTransactions(data);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setError(err instanceof ApiError ? err.message : 'Unable to load transactions.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [accountId, limit]);

  if (loading) {
    return (
      <div className={`flex flex-1 items-center justify-center text-[14px] text-muted ${className}`}>
        Loading transactions…
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex flex-1 items-center justify-center text-center text-[14px] text-red-600 ${className}`}>
        {error}
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className={`flex flex-1 flex-col items-center justify-center gap-4 ${className}`}>
        <span className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-white text-primary">
          <HistoryIcon className="h-8 w-8" />
        </span>
        <div className="flex flex-col items-center gap-2 text-center">
          <p className="text-[22px] font-semibold leading-[1.21] text-ink">No transactions yet</p>
          <p className="max-w-[425px] text-[13px] leading-[1.21] text-muted">
            Your recent deposits, withdrawals, and transfers will appear here.
          </p>
        </div>
      </div>
    );
  }

  const isPositive = (transaction: Transaction) => transaction.type === 'deposit';
  const formatAmount = (transaction: Transaction) =>
    formatCurrency(transaction.amount, transaction.currency || currency || 'PHP');
  const receiptAccount = receipt
    ? accounts.find((item) => item.id === receipt.accountId) ?? null
    : null;

  return (
    <>
      <ul className={`flex flex-col gap-3 overflow-y-auto pr-1 ${className}`}>
        {transactions.map((transaction) => (
          <li key={transaction.id}>
            <button
              type="button"
              onClick={() => setReceipt(transaction)}
              title="View receipt"
              className="flex w-full items-center gap-4 rounded-[20px] bg-white p-4 text-left transition-colors hover:bg-surface-card focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-hover"
            >
              <span className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-surface-card text-primary">
                {typeIcon[transaction.type]}
              </span>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[15px] font-semibold leading-[1.21] text-ink">
                  {transaction.note || transaction.counterparty || transaction.type}
                </span>
                <span className="text-[13px] leading-[1.21] text-muted">
                  {formatDateTime(transaction.createdAt)} · {transaction.reference}
                </span>
              </div>
              <div className="flex flex-col items-end">
                <span
                  className={`text-[15px] font-semibold leading-[1.21] ${
                    isPositive(transaction) ? 'text-emerald-600' : 'text-ink'
                  }`}
                >
                  {isPositive(transaction) ? '+' : '−'}
                  {formatAmount(transaction)}
                </span>
                <span className={`text-[12px] leading-[1.21] ${statusTone[transaction.status]}`}>
                  {transaction.status}
                </span>
              </div>
            </button>
          </li>
        ))}
      </ul>
      {receipt && (
        <ReceiptModal
          transaction={receipt}
          account={receiptAccount}
          onClose={() => setReceipt(null)}
        />
      )}
    </>
  );
};

export default TransactionList;
