import ChevronDownIcon from '@/components/icons/ChevronDownIcon';
import ChevronRightIcon from '@/components/icons/ChevronRightIcon';
import LightbulbIcon from '@/components/icons/LightbulbIcon';
import DonutChart from '@/components/dashboard/DonutChart';

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

    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 rounded-[24px] border border-surface-line bg-white p-4">
        <div className="flex items-center justify-between">
          <p className="text-[16px] font-semibold leading-[19px] text-ink">Spending habits</p>
          <span className="flex h-[27px] items-center rounded-full bg-surface-input px-2.5 text-[16px] font-semibold leading-[19px] text-muted">
            Sample
          </span>
        </div>
        <div className="flex items-center gap-4">
          <DonutChart />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-[14px] font-semibold leading-[17px] text-ink">AI tips</p>

        <div className="flex flex-col gap-2 rounded-[20px] border border-surface-line bg-white p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-surface-card text-primary">
                <LightbulbIcon className="h-5 w-5" />
              </span>
              <span className="text-[16px] font-semibold leading-[19px] text-ink">
                Set a weekly dining limit
              </span>
            </div>
            <ChevronDownIcon className="h-4 w-4 flex-none rotate-180 text-ink" />
          </div>
          <p className="text-[16px] font-normal leading-[19px] text-muted">
            Choose a weekly dining budget and review it before eating out.
          </p>
        </div>

        <div className="flex items-center justify-between rounded-[20px] border border-surface-line bg-white p-3">
          <div className="flex items-center gap-3">
            <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-surface-card text-primary">
              <LightbulbIcon className="h-5 w-5" />
            </span>
            <span className="text-[16px] font-normal leading-[19px] text-ink">
              Plan ahead for travel costs
            </span>
          </div>
          <ChevronDownIcon className="h-4 w-4 flex-none text-ink" />
        </div>
      </div>
    </div>
  </section>
);

export default AiInsightsCard;
