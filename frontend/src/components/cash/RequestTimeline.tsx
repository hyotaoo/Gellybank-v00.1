import { Fragment } from 'react';
import CircleCheckIcon from '@/components/icons/CircleCheckIcon';
import FileTextIcon from '@/components/icons/FileTextIcon';
import LoaderIcon from '@/components/icons/LoaderIcon';

const steps = [
  { label: 'Request submitted', icon: FileTextIcon },
  { label: 'Processing', icon: LoaderIcon },
  { label: 'Completed', icon: CircleCheckIcon },
] as const;

const badgeCopy = ['Pending', 'Processing', 'Completed'] as const;

// Figma 2151:412 — 624x248 r20 white border, header 21, steps block 191
export const RequestTimeline = ({ stage }: { stage: 0 | 1 | 2 }) => {
  const active = stage === 2;

  return (
    <div className="flex flex-none flex-col gap-3 rounded-[20px] border border-surface-line bg-white px-4 py-3">
      <div className="flex items-center justify-between">
        <span className="text-[16px] font-semibold leading-[19px] text-ink">Request progress</span>
        <span
          className={`flex h-[21px] items-center rounded-full px-2.5 text-[14px] font-semibold leading-[17px] ${
            active ? 'bg-surface-card text-primary' : 'bg-[#FFF7DF] text-[#8B6C27]'
          }`}
        >
          {badgeCopy[stage]}
        </span>
      </div>

      <div className="flex h-[191px] flex-col justify-center gap-2 px-4">
        <div className="flex items-center px-[73px]">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const done = stage >= index;
            return (
              <Fragment key={step.label}>
                {index > 0 ? (
                  <span
                    className={`h-0.5 flex-1 ${
                      stage >= index ? 'bg-rose-300' : 'bg-surface-line'
                    }`}
                  />
                ) : null}
                <span
                  className={`flex h-10 w-10 flex-none items-center justify-center rounded-full ${
                    done ? 'bg-surface-card text-primary' : 'bg-surface-card/60 text-muted'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                </span>
              </Fragment>
            );
          })}
        </div>

        <div className="flex">
          {steps.map((step) => (
            <span
              key={step.label}
              className="w-1/3 text-center text-[14px] font-semibold leading-[17px] text-ink"
            >
              {step.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};