import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ApiError } from '@/api/client';
import { listTransactions } from '@/api/transactions';
import type { Transaction } from '@/api/transactions';
import AccountSwitcher from '@/components/dashboard/AccountSwitcher';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import TransactionDetailsDrawer from '@/components/dashboard/TransactionDetailsDrawer';
import CalendarIcon from '@/components/icons/CalendarIcon';
import ChevronDownIcon from '@/components/icons/ChevronDownIcon';
import ChevronRightIcon from '@/components/icons/ChevronRightIcon';
import ClockIcon from '@/components/icons/ClockIcon';
import DownloadIcon from '@/components/icons/DownloadIcon';
import FileTextIcon from '@/components/icons/FileTextIcon';
import SearchIcon from '@/components/icons/SearchIcon';
import { useAccounts } from '@/context/AccountContext';
import { formatCurrency, maskAccountNumber } from '@/utils/format';
import { downloadReceipt } from '@/utils/receipt';
import {
  dateLabel,
  describe,
  statusCopy,
  timeLabel,
  typeCopy,
} from '@/utils/transactionDisplay';

type TypeFilter = 'all' | 'deposit' | 'withdraw' | 'transfer';
type StatusFilter = 'all' | Transaction['status'];
type RangeFilter = 'all' | '7d' | '30d' | 'month';

const PAGE_SIZE = 6;

const FilterField = ({
  children,
  className = '',
  compact = false,
}: {
  children: ReactNode;
  className?: string;
  compact?: boolean;
}) => (
  <div
    className={`relative flex flex-none items-center rounded-[16px] border border-[#E8E0D8] bg-white ${
      compact ? 'h-11 gap-2 pl-3.5 pr-9' : 'h-[52px] gap-2.5 pl-4 pr-10'
    } ${className}`}
  >
    {children}
  </div>
);

const HistoryPage = () => {
  const {
    accounts,
    selectedAccount,
    loading: accountsLoading,
    error: accountsError,
  } = useAccounts();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [range, setRange] = useState<RangeFilter>('30d');
  const [type, setType] = useState<TypeFilter>('all');
  const [page, setPage] = useState(1);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const lastTriggerRef = useRef<HTMLButtonElement | null>(null);
  const closeTimerRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(undefined);
    listTransactions({ accountId: selectedAccount?.id, limit: 200 }, controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return;
        setTransactions(data);
        setLoading(false);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setError(err instanceof ApiError ? err.message : 'Unable to load transactions.');
        setLoading(false);
      });
    return () => controller.abort();
  }, [selectedAccount?.id]);

  useEffect(() => {
    setDrawerOpen(false);
    setSelectedTransaction(null);
    if (closeTimerRef.current !== undefined) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = undefined;
    }
  }, [selectedAccount?.id]);

  useEffect(
    () => () => {
      if (closeTimerRef.current !== undefined) window.clearTimeout(closeTimerRef.current);
    },
    [],
  );

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const now = Date.now();
    const windowStart =
      range === '7d'
        ? now - 7 * 24 * 60 * 60 * 1000
        : range === '30d'
          ? now - 30 * 24 * 60 * 60 * 1000
          : null;
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();

    return transactions
      .filter((transaction) => (type === 'all' ? true : transaction.type === type))
      .filter((transaction) => (status === 'all' ? true : transaction.status === status))
      .filter((transaction) => {
        if (range === 'all') return true;
        const created = new Date(transaction.createdAt).getTime();
        if (Number.isNaN(created)) return true;
        if (range === 'month') return created >= monthStart;
        return windowStart !== null && created >= windowStart;
      })
      .filter((transaction) => {
        if (!needle) return true;
        const haystack = [
          transaction.counterparty ?? '',
          transaction.note ?? '',
          transaction.reference,
          typeCopy[transaction.type].label,
        ]
          .join(' ')
          .toLowerCase();
        return haystack.includes(needle);
      })
      .sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
  }, [transactions, type, status, range, search]);

  useEffect(() => {
    setPage(1);
  }, [search, status, range, type]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const start = (currentPage - 1) * PAGE_SIZE;
  const rows = filtered.slice(start, start + PAGE_SIZE);
  const from = filtered.length === 0 ? 0 : start + 1;
  const to = Math.min(start + PAGE_SIZE, filtered.length);

  const accountContext = selectedAccount
    ? `GellyBank ${selectedAccount.label} ${maskAccountNumber(selectedAccount.accountNumber)}`
    : 'All accounts';

  const getAccountForTransaction = (transaction: Transaction) =>
    accounts.find((account) => account.id === transaction.accountId) ?? selectedAccount;

  const drawerAccount = useMemo(() => {
    if (!selectedTransaction) return selectedAccount;
    return (
      accounts.find((account) => account.id === selectedTransaction.accountId) ?? selectedAccount
    );
  }, [accounts, selectedAccount, selectedTransaction]);

  const openDrawer = useCallback((transaction: Transaction, trigger: HTMLButtonElement) => {
    if (closeTimerRef.current !== undefined) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = undefined;
    }
    lastTriggerRef.current = trigger;
    setSelectedTransaction(transaction);
    setDrawerOpen(true);
  }, []);

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    if (closeTimerRef.current !== undefined) window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = window.setTimeout(() => {
      setSelectedTransaction(null);
      closeTimerRef.current = undefined;
      lastTriggerRef.current?.focus();
    }, 320);
  }, []);

  const condensed = drawerOpen || selectedTransaction !== null;

  return (
    <DashboardLayout title="History">
      <div className="flex h-[884px] w-full flex-col gap-3 pb-10 pl-[14px] pr-[23px] pt-1">
        <div className="flex-none">
          <AccountSwitcher />
        </div>
        <div className="relative flex min-h-0 w-full flex-1">
          <section
            data-testid="history-card"
            className={`flex h-full flex-none flex-col overflow-hidden rounded-[36px] bg-white/90 ring-1 ring-inset ring-surface-line transition-[width] duration-300 ease-out motion-reduce:transition-none ${
              drawerOpen ? 'w-[689px] gap-4 p-6' : 'w-[1040px] gap-5 p-8'
            }`}
          >
            <div className={`flex flex-none flex-col ${condensed ? 'gap-[5px]' : 'gap-2'}`}>
              {condensed ? (
                <>
                  <h2 className="text-[32px] font-semibold leading-[38px] text-ink">
                    Transaction history
                  </h2>
                  <p className="text-[15px] font-normal leading-[18px] text-muted">
                    Keep track of your deposits, withdrawals, and transfers.
                  </p>
                  <span className="text-[14px] font-normal leading-[17px] text-[#6E6168]">
                    {accountContext}
                  </span>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <h2 className="text-[36px] font-semibold leading-[43px] text-ink">
                      Transaction history
                    </h2>
                    <span className="text-[14px] font-normal leading-[17px] text-[#6E6168]">
                      {accountContext}
                    </span>
                  </div>
                  <p className="text-[15px] font-normal leading-[18px] text-muted">
                    Keep track of your deposits, withdrawals, and transfers.
                  </p>
                </>
              )}
            </div>

            <div
              className={`flex flex-none ${
                condensed ? 'flex-col gap-2.5' : 'items-center gap-3'
              }`}
            >
              <label
                className={`relative flex flex-none items-center gap-2.5 rounded-[16px] border border-[#E8E0D8] bg-white ${
                  condensed ? 'h-11 w-full pl-3.5 pr-3.5' : 'h-[52px] w-[510px] pl-4 pr-4'
                }`}
              >
                <SearchIcon className="h-5 w-5 flex-none text-muted" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search name or reference number"
                  aria-label="Search transactions"
                  className="w-full bg-transparent text-[15px] font-normal leading-[18px] text-ink outline-none placeholder:text-muted"
                />
              </label>

              <div className={condensed ? 'flex items-center gap-2.5' : 'contents'}>
                <FilterField compact={condensed} className={condensed ? 'w-[461px]' : 'w-[288px]'}>
                  <CalendarIcon className="h-5 w-5 flex-none text-[#6E6168]" />
                  <select
                    value={range}
                    onChange={(event) => setRange(event.target.value as RangeFilter)}
                    aria-label="Date range"
                    className="w-full appearance-none bg-transparent text-[15px] font-normal leading-[18px] text-ink outline-none"
                  >
                    <option value="month">This month</option>
                    <option value="30d">Last 30 days</option>
                    <option value="7d">Last 7 days</option>
                    <option value="all">All time</option>
                  </select>
                  <ChevronDownIcon
                    className={`pointer-events-none absolute h-4 w-4 text-[#6E6168] ${
                      condensed ? 'right-3.5' : 'right-4'
                    }`}
                  />
                </FilterField>

                <FilterField compact={condensed} className={condensed ? 'w-[170px]' : 'w-[154px]'}>
                  <select
                    value={status}
                    onChange={(event) => setStatus(event.target.value as StatusFilter)}
                    aria-label="Status"
                    className="w-full appearance-none bg-transparent text-[15px] font-normal leading-[18px] text-ink outline-none"
                  >
                    <option value="all">All statuses</option>
                    <option value="pending">Pending</option>
                    <option value="completed">Completed</option>
                    <option value="failed">Failed</option>
                    <option value="void">Void</option>
                  </select>
                  <ChevronDownIcon
                    className={`pointer-events-none absolute h-4 w-4 text-[#6E6168] ${
                      condensed ? 'right-3.5' : 'right-4'
                    }`}
                  />
                </FilterField>
              </div>
            </div>

            <div
              className={`flex flex-none items-center justify-between ${
                condensed ? 'h-[38px]' : 'h-[42px]'
              }`}
            >
              <div
                className={`flex items-center gap-1 rounded-[16px] bg-surface-card p-1 ${
                  condensed ? 'h-[38px]' : 'h-[42px]'
                }`}
              >
                {(
                  [
                    { value: 'all', label: 'All transactions' },
                    { value: 'deposit', label: 'Deposits' },
                    { value: 'withdraw', label: 'Withdrawals' },
                    { value: 'transfer', label: 'Transfers' },
                  ] as { value: TypeFilter; label: string }[]
                ).map((tab) => {
                  const active = tab.value === type;
                  return (
                    <button
                      key={tab.value}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setType(tab.value)}
                      className={`flex items-center rounded-[12px] font-semibold transition-colors ${
                        condensed
                          ? 'h-[30px] px-3 text-[13px] leading-[16px]'
                          : 'h-[34px] px-4 text-[14px] leading-[17px]'
                      } ${
                        active ? 'bg-white text-primary' : 'text-[#6E6168] hover:text-ink'
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>
              <span
                className={
                  condensed
                    ? 'text-[12px] font-normal leading-[14px] text-[#6E6168]'
                    : 'text-[14px] font-normal leading-[17px] text-[#6E6168]'
                }
              >
                {filtered.length} {filtered.length === 1 ? 'transaction' : 'transactions'} · Newest
                first
              </span>
            </div>

            <div
              data-testid="history-table"
              className={`flex w-full flex-none flex-col ${
                condensed ? 'h-[490px]' : 'h-[496px]'
              }`}
            >
              <div
                data-testid="history-table-header"
                className={`flex flex-none items-center border-b border-surface-line text-[#6E6168] ${
                  condensed
                    ? 'h-[34px] gap-2 text-[13px] font-semibold leading-[16px]'
                    : 'h-10 gap-3 text-[14px] font-semibold leading-[17px]'
                }`}
              >
                {condensed ? (
                  <>
                    <span className="w-[302px] flex-none">Transaction / Reference number</span>
                    <span className="w-[88px] flex-none">Date &amp; time</span>
                    <span className="w-[86px] flex-none">Amount (PHP)</span>
                    <span className="w-[101px] flex-none">Status</span>
                    <span className="w-8 flex-none" />
                  </>
                ) : (
                  <>
                    <span className="w-[300px] flex-none">Transaction</span>
                    <span className="w-[118px] flex-none">Date &amp; time</span>
                    <span className="w-[160px] flex-none">Reference number</span>
                    <span className="w-[120px] flex-none">Amount (PHP)</span>
                    <span className="w-[118px] flex-none">Status</span>
                    <span className="w-[100px] flex-none">Receipt</span>
                  </>
                )}
              </div>

              {accountsLoading || loading ? (
                <div className="flex flex-1 items-center justify-center text-[14px] text-muted">
                  Loading transactions&#8230;
                </div>
              ) : error || accountsError ? (
                <div className="flex flex-1 items-center justify-center text-[14px] text-red-600">
                  {error ?? accountsError}
                </div>
              ) : rows.length === 0 ? (
                <div className="flex flex-1 items-center justify-center text-[14px] text-muted">
                  No transactions match your filters.
                </div>
              ) : (
                rows.map((transaction) => {
                  const typeInfo = typeCopy[transaction.type];
                  const TypeIcon = typeInfo.icon;
                  const badge = statusCopy[transaction.status];
                  const isDeposit = transaction.type === 'deposit';
                  const receiptReady = transaction.status === 'completed';
                  const selected = drawerOpen && selectedTransaction?.id === transaction.id;
                  const rowAccount = getAccountForTransaction(transaction);

                  return (
                    <div
                      key={transaction.id}
                      className={`group relative flex h-[76px] flex-none cursor-pointer items-center transition-colors ${
                        selected
                          ? 'rounded-[10px] bg-blush ring-1 ring-inset ring-primary'
                          : 'border-b border-surface-line hover:bg-surface-card/40'
                      }`}
                    >
                      <button
                        type="button"
                        aria-label={`View details for ${typeInfo.label} ${formatCurrency(
                          transaction.amount,
                          transaction.currency,
                        )} on ${dateLabel(transaction.createdAt)}`}
                        aria-expanded={selected}
                        aria-controls="transaction-details-drawer"
                        onClick={(event) => openDrawer(transaction, event.currentTarget)}
                        className="absolute inset-0 z-0 rounded-[10px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                      />

                      <div
                        aria-hidden="true"
                        className={`pointer-events-none relative z-10 flex h-full w-full items-center ${
                          condensed ? 'gap-2' : 'gap-3'
                        }`}
                      >
                        <div
                          className={`flex flex-none items-center ${
                            condensed ? 'w-[302px] gap-2.5' : 'w-[300px] gap-3'
                          }`}
                        >
                          <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-surface-card">
                            <TypeIcon className="h-5 w-5 text-primary" />
                          </span>
                          <span
                            className={`flex min-w-0 flex-col ${
                              condensed ? 'gap-0.5' : 'gap-[5px]'
                            }`}
                          >
                            <span className="truncate text-[16px] font-semibold leading-[19px] text-ink">
                              {typeInfo.label}
                            </span>
                            <span className="truncate text-[13px] font-normal leading-[16px] text-[#6E6168]">
                              {describe(transaction, selectedAccount?.label ?? 'account')}
                            </span>
                            {condensed ? (
                              <span className="truncate text-[13px] font-normal leading-[16px] text-muted">
                                {transaction.reference}
                              </span>
                            ) : null}
                          </span>
                        </div>

                        <div
                          className={`flex flex-none flex-col ${
                            condensed ? 'w-[88px] gap-[3px]' : 'w-[118px] gap-[5px]'
                          }`}
                        >
                          <span className="whitespace-nowrap text-[15px] font-normal leading-[18px] text-ink">
                            {dateLabel(transaction.createdAt)}
                          </span>
                          <span className="whitespace-nowrap text-[13px] font-normal leading-[16px] text-muted">
                            {timeLabel(transaction.createdAt)}
                          </span>
                        </div>

                        {!condensed ? (
                          <span className="w-[160px] flex-none truncate text-[13px] font-normal leading-[16px] text-[#6E6168]">
                            {transaction.reference}
                          </span>
                        ) : null}

                        <span
                          className={`flex-none whitespace-nowrap text-[16px] font-semibold leading-[19px] ${
                            condensed ? 'w-[86px]' : 'w-[120px]'
                          } ${isDeposit ? 'text-[#43814C]' : 'text-ink'}`}
                        >
                          {isDeposit ? '+' : '−'}
                          {formatCurrency(transaction.amount, transaction.currency)}
                        </span>

                        <span
                          className={`flex flex-none items-center justify-center ${
                            condensed ? 'w-[101px]' : 'w-[118px]'
                          }`}
                        >
                          <span
                            className="flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[13px] font-semibold leading-[16px]"
                            style={{ backgroundColor: badge.bg, color: badge.text }}
                          >
                            <span
                              className="h-[5px] w-[5px] rounded-full"
                              style={{ backgroundColor: badge.dot }}
                            />
                            {badge.label}
                          </span>
                        </span>

                        <span className={condensed ? 'w-8 flex-none' : 'w-[100px] flex-none'} />
                      </div>

                      <span
                        className={`absolute right-0 top-1/2 z-20 flex -translate-y-1/2 items-center ${
                          condensed ? 'w-8' : 'w-[100px]'
                        }`}
                      >
                        {receiptReady ? (
                          condensed ? (
                            <button
                              type="button"
                              aria-label={`Download receipt for ${transaction.reference}`}
                              onClick={() => downloadReceipt(transaction, rowAccount)}
                              className="pointer-events-auto flex h-8 w-8 items-center justify-center rounded-[10px] bg-surface-card text-primary transition-colors hover:bg-blush"
                            >
                              <DownloadIcon className="h-4 w-4" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => downloadReceipt(transaction, rowAccount)}
                              className="pointer-events-auto flex h-9 w-full items-center justify-center gap-1.5 rounded-[10px] bg-surface-card text-[13px] font-semibold leading-[16px] text-primary transition-colors hover:bg-blush"
                            >
                              <DownloadIcon className="h-4 w-4" />
                              Download
                            </button>
                          )
                        ) : condensed ? (
                          <span
                            className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-white text-muted"
                            title="Receipt not ready"
                          >
                            <ClockIcon className="h-4 w-4" />
                          </span>
                        ) : (
                          <span className="flex h-9 w-full items-center justify-center gap-1.5 rounded-[10px] bg-white text-[13px] font-semibold leading-[16px] text-muted">
                            <ClockIcon className="h-4 w-4" />
                            Not ready
                          </span>
                        )}
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            <div
              data-testid="history-footer"
              className={`flex flex-none items-center justify-between ${
                condensed ? 'h-4' : 'h-5 pt-1'
              }`}
            >
              <span className="flex items-center gap-2 text-[13px] font-normal leading-[16px] text-[#6E6168]">
                <FileTextIcon className="h-4 w-4 text-muted" />
                PDF receipts are available for completed transactions.
              </span>
              <div className={`flex items-center ${condensed ? 'gap-2' : 'gap-3'}`}>
                {pageCount > 1 ? (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      aria-label="Previous page"
                      disabled={currentPage === 1}
                      onClick={() => setPage(currentPage - 1)}
                      className={`flex items-center justify-center rounded-full text-[#6E6168] transition-colors hover:bg-surface-card disabled:opacity-40 ${
                        condensed ? 'h-4 w-4' : 'h-6 w-6'
                      }`}
                    >
                      <ChevronRightIcon
                        className={`${condensed ? 'h-3 w-3' : 'h-4 w-4'} rotate-180`}
                      />
                    </button>
                    <span
                      className={
                        condensed
                          ? 'text-[11px] font-medium text-[#6E6168]'
                          : 'text-[12px] font-medium text-[#6E6168]'
                      }
                    >
                      {currentPage} / {pageCount}
                    </span>
                    <button
                      type="button"
                      aria-label="Next page"
                      disabled={currentPage === pageCount}
                      onClick={() => setPage(currentPage + 1)}
                      className={`flex items-center justify-center rounded-full text-[#6E6168] transition-colors hover:bg-surface-card disabled:opacity-40 ${
                        condensed ? 'h-4 w-4' : 'h-6 w-6'
                      }`}
                    >
                      <ChevronRightIcon className={condensed ? 'h-3 w-3' : 'h-4 w-4'} />
                    </button>
                  </div>
                ) : null}
                <span
                  className={
                    condensed
                      ? 'text-[12px] font-normal leading-[14px] text-muted'
                      : 'text-[13px] font-normal leading-[16px] text-muted'
                  }
                >
                  Showing {from}–{to} of {filtered.length}
                </span>
              </div>
            </div>
          </section>

          <TransactionDetailsDrawer
            transaction={selectedTransaction}
            account={drawerAccount}
            open={drawerOpen}
            onClose={closeDrawer}
          />
        </div>
      </div>
    </DashboardLayout>
  );
};

export default HistoryPage;
