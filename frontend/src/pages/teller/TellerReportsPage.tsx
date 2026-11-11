import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { ApiError } from '@/api/client';
import { exportTellerReports, getTellerReports } from '@/api/reports';
import type { TellerReports } from '@/api/reports';
import DepositIcon from '@/components/icons/DepositIcon';
import HistoryIcon from '@/components/icons/HistoryIcon';
import TransferIcon from '@/components/icons/TransferIcon';
import WithdrawIcon from '@/components/icons/WithdrawIcon';
import TellerHeader from '@/components/teller/TellerHeader';
import usePolling from '@/hooks/usePolling';
import { formatCurrency, formatDate } from '@/utils/format';

const downloadBlob = (blob: Blob, name: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
};

const TellerReportsPage = () => {
  const [report, setReport] = useState<TellerReports>();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [exporting, setExporting] = useState(false);

  const load = async (rangeFrom = '', rangeTo = '', silent = false) => {
    if (!silent) setLoading(true);
    setError(undefined);
    try {
      setReport(await getTellerReports({
        from: rangeFrom || undefined,
        to: rangeTo || undefined,
      }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to load reports.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the report current without a manual reload.
  usePolling(() => { void load(from, to, true); });

  const applyRange = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void load(from, to);
  };

  const handleExport = async () => {
    setExporting(true);
    setError(undefined);
    try {
      const blob = await exportTellerReports({ from: from || undefined, to: to || undefined });
      downloadBlob(blob, 'gellybank_teller_transactions.csv');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to export the report.');
    } finally {
      setExporting(false);
    }
  };

  const currency = 'PHP';
  const summary = report?.range;

  const stats = [
    {
      label: 'Deposits',
      value: formatCurrency(summary?.deposits.total ?? 0, currency),
      detail: `${summary?.deposits.count ?? 0} transactions`,
      icon: <DepositIcon className="h-5 w-5" />,
      tone: 'bg-emerald-50 text-emerald-600',
    },
    {
      label: 'Withdrawals',
      value: formatCurrency(summary?.withdrawals.total ?? 0, currency),
      detail: `${summary?.withdrawals.count ?? 0} transactions`,
      icon: <WithdrawIcon className="h-5 w-5" />,
      tone: 'bg-amber-50 text-amber-600',
    },
    {
      label: 'Net movement',
      value: formatCurrency(
        (summary?.deposits.total ?? 0) - (summary?.withdrawals.total ?? 0),
        currency,
      ),
      detail: `${(summary?.deposits.count ?? 0) + (summary?.withdrawals.count ?? 0)} transactions`,
      icon: <TransferIcon className="h-5 w-5" />,
      tone: 'bg-surface-card text-primary',
    },
    {
      label: 'Requests reviewed',
      value: String(report?.requests.total ?? 0),
      detail: `${report?.requests.approved ?? 0} approved · ${report?.requests.rejected ?? 0} rejected`,
      icon: <HistoryIcon className="h-5 w-5" />,
      tone: 'bg-sky-50 text-sky-600',
    },
  ];

  return (
    <section className="flex flex-col gap-6">
      <TellerHeader
        title="Reports"
        actions={
          <button
            type="button"
            onClick={() => void handleExport()}
            disabled={exporting}
            className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-ink disabled:opacity-50"
          >
            {exporting ? 'Exporting…' : 'Export CSV'}
          </button>
        }
      />

      <form className="flex flex-wrap items-end gap-3" onSubmit={applyRange}>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted">
          From
          <input
            type="date"
            aria-label="From date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
            className="h-[43px] rounded-xl border border-surface-line bg-white px-3 text-sm text-ink outline-none focus:border-primary"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted">
          To
          <input
            type="date"
            aria-label="To date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
            className="h-[43px] rounded-xl border border-surface-line bg-white px-3 text-sm text-ink outline-none focus:border-primary"
          />
        </label>
        <button
          type="submit"
          className="h-[43px] rounded-xl bg-primary px-5 text-sm font-semibold text-ink"
        >
          Apply
        </button>
        {(from || to) && (
          <button
            type="button"
            onClick={() => {
              setFrom('');
              setTo('');
              void load('', '');
            }}
            className="h-[43px] rounded-xl border border-surface-line px-4 text-sm font-medium hover:bg-surface-card"
          >
            Clear
          </button>
        )}
      </form>

      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <article
            key={stat.label}
            className="flex items-center gap-4 rounded-[24px] border border-surface-line bg-white p-5"
          >
            <span className={`flex h-11 w-11 flex-none items-center justify-center rounded-[14px] ${stat.tone}`}>
              {stat.icon}
            </span>
            <div className="min-w-0">
              <p className="text-[13px] leading-[1.21] text-muted">{stat.label}</p>
              <p className="mt-1 truncate text-[24px] font-semibold leading-none text-ink">
                {loading && !report ? '—' : stat.value}
              </p>
              <p className="text-xs text-muted">{stat.detail}</p>
            </div>
          </article>
        ))}
      </div>

      <section className="rounded-[24px] border border-surface-line bg-white p-5 sm:p-6">
        <h2 className="text-[18px] font-semibold">Today</h2>
        <p className="mt-1 text-sm text-muted">Transactions you processed today.</p>
        <dl className="mt-4 divide-y divide-surface-line">
          <div className="flex items-center justify-between gap-3 py-3 text-sm">
            <dt className="text-muted">Deposits</dt>
            <dd className="font-semibold">
              {formatCurrency(report?.today.deposits.total ?? 0, currency)}
              <span className="ml-2 text-xs font-normal text-muted">
                {report?.today.deposits.count ?? 0}
              </span>
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3 py-3 text-sm">
            <dt className="text-muted">Withdrawals</dt>
            <dd className="font-semibold">
              {formatCurrency(report?.today.withdrawals.total ?? 0, currency)}
              <span className="ml-2 text-xs font-normal text-muted">
                {report?.today.withdrawals.count ?? 0}
              </span>
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3 py-3 text-sm">
            <dt className="text-muted">Other transactions</dt>
            <dd className="font-semibold">{report?.today.other.count ?? 0}</dd>
          </div>
        </dl>
      </section>

      <section className="overflow-hidden rounded-[28px] border border-surface-line bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-6">
          <h2 className="text-[18px] font-semibold leading-[1.21]">Daily transaction report</h2>
          <span className="text-sm text-muted">Newest first</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left">
            <thead className="bg-surface-soft text-[12px] uppercase tracking-wide text-muted">
              <tr>
                <th className="px-5 py-3 font-medium sm:px-6">Date</th>
                <th className="px-5 py-3 text-right font-medium sm:px-6">Deposits</th>
                <th className="px-5 py-3 text-right font-medium sm:px-6">Deposit total</th>
                <th className="px-5 py-3 text-right font-medium sm:px-6">Withdrawals</th>
                <th className="px-5 py-3 text-right font-medium sm:px-6">Withdrawal total</th>
                <th className="px-5 py-3 text-right font-medium sm:px-6">Net</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-line">
              {(report?.daily ?? []).map((row) => (
                <tr key={row.date}>
                  <td className="px-5 py-4 text-sm font-semibold sm:px-6">{formatDate(row.date)}</td>
                  <td className="px-5 py-4 text-right text-sm sm:px-6">{row.deposits}</td>
                  <td className="px-5 py-4 text-right text-sm sm:px-6">
                    {formatCurrency(row.depositsTotal, currency)}
                  </td>
                  <td className="px-5 py-4 text-right text-sm sm:px-6">{row.withdrawals}</td>
                  <td className="px-5 py-4 text-right text-sm sm:px-6">
                    {formatCurrency(row.withdrawalsTotal, currency)}
                  </td>
                  <td className="px-5 py-4 text-right text-sm font-semibold sm:px-6">
                    {formatCurrency(row.net, currency)}
                  </td>
                </tr>
              ))}
              {(report?.daily.length ?? 0) === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-sm text-muted">
                    {loading ? 'Loading report…' : 'No transactions in this range.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
};

export default TellerReportsPage;
