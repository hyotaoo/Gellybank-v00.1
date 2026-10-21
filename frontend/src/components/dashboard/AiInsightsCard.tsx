import { useEffect, useRef, useState } from 'react';
import { ApiError } from '@/api/client';
import { getSpendingInsights } from '@/api/insights';
import type { SpendingInsights } from '@/api/insights';
import AiInsightsIcon from '@/components/icons/AiInsightsIcon';
import ChevronRightIcon from '@/components/icons/ChevronRightIcon';
import LightbulbIcon from '@/components/icons/LightbulbIcon';
import DonutChart from '@/components/dashboard/DonutChart';
import type { DonutSegment } from '@/components/dashboard/DonutChart';
import { useAccounts } from '@/context/AccountContext';
import { formatCurrency } from '@/utils/format';

const PALETTE = ['#D987A3', '#9C9496', '#F8E7B9', '#A8C5DA', '#B6A8D9', '#E0A9A0'];

const AiInsightsCard = () => {
  const { selectedAccount } = useAccounts();
  const [insights, setInsights] = useState<SpendingInsights | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController>();

  useEffect(() => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    setLoading(true);
    setError(null);

    getSpendingInsights(selectedAccount?.id, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setInsights(data);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setError(err instanceof ApiError ? err.message : 'Unable to load insights.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [selectedAccount?.id]);

  const segments: DonutSegment[] = (insights?.categories ?? []).map((category, index) => ({
    label: `${category.label} (${category.value}%)`,
    color: category.color ?? PALETTE[index % PALETTE.length],
    value: category.value,
  }));

  const tips = insights?.tips ?? [];

  return (
    <section className="flex h-[500px] flex-1 flex-col gap-6 rounded-[36px] border border-surface-line bg-surface-soft p-8">
      <header className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-[20px] font-normal leading-[1.21] text-ink">AI Insights</h2>
          <button
            type="button"
            aria-label="View all insights"
            className="flex h-5 w-5 items-center justify-center text-ink transition-opacity hover:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-hover"
          >
            <ChevronRightIcon className="h-[18px] w-[18px]" />
          </button>
        </div>
        <span className="block h-px w-full bg-ink/10" />
      </header>

      <div className="flex flex-col gap-3 overflow-y-auto pr-1">
        <div className="flex flex-col gap-3 rounded-[24px] bg-white p-4">
          <div className="flex items-center justify-between">
            <p className="text-[14px] font-semibold leading-[1.21] text-ink">Spending habits</p>
            <span className="rounded-full bg-surface-soft px-2.5 py-1 text-[13px] leading-[1.21] text-muted">
              {loading
                ? 'Loading…'
                : insights
                  ? formatCurrency(insights.total, insights.currency)
                  : 'Sample'}
            </span>
          </div>
          {error ? (
            <p className="text-[13px] leading-[1.21] text-red-600">{error}</p>
          ) : (
            <DonutChart segments={loading ? [] : segments} />
          )}
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-[14px] font-semibold leading-[1.21] text-ink">AI tips</p>

          {tips.length === 0 ? (
            <div className="flex items-center gap-3 rounded-[20px] bg-white p-3">
              <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-surface-card text-primary">
                <LightbulbIcon className="h-3.5 w-3.5" />
              </span>
              <span className="text-[14px] font-semibold leading-[1.21] text-ink">
                No tips yet — add a few transactions.
              </span>
            </div>
          ) : (
            tips.map((tip, index) => (
              <div key={tip} className="flex items-center gap-3 rounded-[20px] bg-white p-3">
                <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-surface-card text-primary">
                  {index === 0 ? (
                    <AiInsightsIcon className="h-3.5 w-3.5" />
                  ) : (
                    <LightbulbIcon className="h-3.5 w-3.5" />
                  )}
                </span>
                <span className="text-[14px] font-semibold leading-[1.21] text-ink">{tip}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
};

export default AiInsightsCard;
