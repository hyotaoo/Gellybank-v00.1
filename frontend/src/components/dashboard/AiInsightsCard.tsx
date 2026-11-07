import ChevronRightIcon from '@/components/icons/ChevronRightIcon';

// Figma 12:3 — 337 wide, r36, p32, white card
const AiInsightsCard = () => (
  <section className="flex h-full flex-col gap-6 overflow-hidden rounded-[36px] border border-surface-line bg-white p-8">
    <header className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <h2 className="text-[36px] font-bold leading-[43px] text-ink">AI Insights</h2>
        <button
          type="button"
          aria-label="View all insights"
          className="flex h-5 w-5 items-center justify-center transition-opacity hover:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-hover"
        >
          <ChevronRightIcon className="h-5 w-5" />
        </button>
      </div>
      <span className="block h-px w-full bg-ink/10" />
    </header>

    <div className="flex flex-1 flex-col items-center justify-center rounded-[24px] border border-dashed border-surface-line p-6 text-center">
      <p className="text-[16px] font-semibold leading-[19px] text-ink">No insights yet</p>
      <p className="mt-2 text-[14px] font-normal leading-[17px] text-muted">
        Spending insights will appear here once you have transaction activity.
      </p>
    </div>
  </section>
);

export default AiInsightsCard;
