import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { ApiError } from '@/api/client';
import { exportAdminReports, getAdminReports } from '@/api/admin';
import type { ReportsSummary } from '@/api/admin';
import Button from '@/components/common/Button';
import DepositIcon from '@/components/icons/DepositIcon';
import WithdrawIcon from '@/components/icons/WithdrawIcon';
import { formatCurrency } from '@/utils/format';

const TYPE_LABELS: Record<string, string> = {
  DEPOSIT: 'Deposits',
  WITHDRAWAL: 'Withdrawals',
  TRANSFER_IN: 'Transfers in',
  TRANSFER_OUT: 'Transfers out',
  ADJUSTMENT: 'Adjustments',
};

const downloadBlob = (blob: Blob, name: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
};

const AdminReportsPage = () => {
  const [report, setReport] = useState<ReportsSummary>();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async (rangeFrom = '', rangeTo = '') => {
    setLoading(true);
    setError(undefined);
    try {
      setReport(await getAdminReports({
        from: rangeFrom || undefined,
        to: rangeTo || undefined,
      }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to load reports.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const applyRange = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void load(from, to);
  };

  const handleExport = async () => {
    setExporting(true);
    setError(undefined);
    try {
      const blob = await exportAdminReports({ from: from || undefined, to: to || undefined });
      downloadBlob(blob, 'gellybank_transactions.csv');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to export the report.');
    } finally {
      setExporting(false);
    }
  };

  const typeRow = (label: string, summary?: { count: number; total: number }) => (
    <div key={label} className="flex items-center justify-between gap-3 py-3 text-sm">
      <p className="font-semibold">{label}</p>
      <div className="text-right">
        <p className="font-semibold text-ink">{formatCurrency(summary?.total ?? 0)}</p>
        <p className="text-xs text-muted">{summary?.count ?? 0} transactions</p>
      </div>
    </div>
  );

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold text-primary">Reports &amp; analytics</h1>
        </div>
        <Button
          type="button"
          className="h-[44px] px-5 text-[14px] font-semibold"
          disabled={exporting}
          onClick={() => void handleExport()}
        >
          {exporting ? 'Exporting…' : 'Export CSV'}
        </Button>
      </header>

      <form className="flex flex-wrap items-center gap-2" onSubmit={applyRange}>
        <label className="flex items-center gap-2 text-sm text-muted">
          From
          <input
            type="date"
            aria-label="From date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
            className="rounded-xl border border-surface-line bg-white px-3 py-2"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-muted">
          To
          <input
            type="date"
            aria-label="To date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
            className="rounded-xl border border-surface-line bg-white px-3 py-2"
          />
        </label>
        <button type="submit" className="rounded-xl bg-primary px-5 font-semibold text-ink">Apply</button>
      </form>

      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="flex items-center gap-4 rounded-[24px] border border-surface-line bg-white p-5">
          <span className="flex h-11 w-11 flex-none items-center justify-center rounded-[14px] bg-emerald-50 text-emerald-600">
            <DepositIcon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-[13px] leading-[1.21] text-muted">Deposits in range</p>
            <p className="mt-1 truncate text-[24px] font-semibold leading-none text-ink">
              {loading ? '—' : formatCurrency(report?.rangeByType.DEPOSIT?.total ?? 0)}
            </p>
            <p className="text-xs text-muted">{report?.rangeByType.DEPOSIT?.count ?? 0} transactions</p>
          </div>
        </article>
        <article className="flex items-center gap-4 rounded-[24px] border border-surface-line bg-white p-5">
          <span className="flex h-11 w-11 flex-none items-center justify-center rounded-[14px] bg-amber-50 text-amber-600">
            <WithdrawIcon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-[13px] leading-[1.21] text-muted">Withdrawals in range</p>
            <p className="mt-1 truncate text-[24px] font-semibold leading-none text-ink">
              {loading ? '—' : formatCurrency(report?.rangeByType.WITHDRAWAL?.total ?? 0)}
            </p>
            <p className="text-xs text-muted">{report?.rangeByType.WITHDRAWAL?.count ?? 0} transactions</p>
          </div>
        </article>
        <article className="flex items-center gap-4 rounded-[24px] border border-surface-line bg-white p-5">
          <div className="min-w-0">
            <p className="text-[13px] leading-[1.21] text-muted">Customers</p>
            <p className="mt-1 truncate text-[24px] font-semibold leading-none text-ink">
              {loading ? '—' : report?.customerStats.totalCustomers ?? '—'}
            </p>
            <p className="text-xs text-muted">
              {loading ? '' : `+${report?.customerStats.newCustomers ?? 0} in range`}
            </p>
          </div>
        </article>
        <article className="flex items-center gap-4 rounded-[24px] border border-surface-line bg-white p-5">
          <div className="min-w-0">
            <p className="text-[13px] leading-[1.21] text-muted">Deployed balance</p>
            <p className="mt-1 truncate text-[24px] font-semibold leading-none text-ink">
              {loading ? '—' : formatCurrency(report?.deployedBalance ?? 0)}
            </p>
            <p className="text-xs text-muted">
              {loading ? '' : `${report?.customerStats.activeAccounts ?? 0} active · ${report?.customerStats.frozenAccounts ?? 0} frozen`}
            </p>
          </div>
        </article>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-[24px] border border-surface-line bg-white p-5 sm:p-6">
          <h2 className="text-[18px] font-semibold leading-[1.21]">Transaction summary (lifetime)</h2>
          <div className="mt-2 divide-y divide-surface-line">
            {Object.entries(report?.lifetimeByType ?? {}).map(([key, summary]) => (
              typeRow(TYPE_LABELS[key] ?? key, summary)
            ))}
            {report && Object.keys(report.lifetimeByType).length === 0 && (
              <p className="py-6 text-center text-sm text-muted">No transactions recorded yet.</p>
            )}
            {!report && (
              <p className="py-6 text-center text-sm text-muted">{loading ? 'Loading…' : '—'}</p>
            )}
          </div>
        </section>

        <section className="rounded-[24px] border border-surface-line bg-white p-5 sm:p-6">
          <h2 className="text-[18px] font-semibold leading-[1.21]">Teller volume {from || to ? '(range)' : ''}</h2>
          <div className="overflow-x-auto">
            <table className="mt-2 w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="py-2 font-medium">Teller</th>
                  <th className="py-2 text-right font-medium">Transactions</th>
                  <th className="py-2 text-right font-medium">Volume</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-line">
                {(report?.tellerStats ?? []).map((teller) => (
                  <tr key={teller.id}>
                    <td className="py-3 font-semibold">{teller.name}</td>
                    <td className="py-3 text-right">{teller.transactions}</td>
                    <td className="py-3 text-right">{formatCurrency(teller.total)}</td>
                  </tr>
                ))}
                {report && report.tellerStats.length === 0 && (
                  <tr><td colSpan={3} className="py-6 text-center text-muted">No teller-processed transactions in this range.</td></tr>
                )}
                {!report && (
                  <tr><td colSpan={3} className="py-6 text-center text-muted">{loading ? 'Loading…' : '—'}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </section>
  );
};

export default AdminReportsPage;
