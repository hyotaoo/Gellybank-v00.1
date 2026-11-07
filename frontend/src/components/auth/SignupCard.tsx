import type { ReactNode } from 'react';
import type { SignupStep } from '@/components/auth/signup';

const STEP_LABELS: Array<{ id: SignupStep; label: string }> = [
  { id: 1, label: 'Personal' },
  { id: 2, label: 'Financial' },
  { id: 3, label: 'Terms' },
];

interface SignupCardProps {
  title: string;
  step: SignupStep;
  children: ReactNode;
}

// Figma 2196:551 — 631 wide, r36, blush 90%, 1px primary, pad 24/54, gap 12
const SignupCard = ({ title, step, children }: SignupCardProps) => (
  <section className="flex w-[631px] flex-col gap-3 rounded-[36px] border border-primary bg-page/90 px-[54px] py-6">
    <h1 className="text-center text-[28px] font-bold leading-[34px] text-ink">{title}</h1>

    <ol className="flex w-full justify-center gap-3">
      {STEP_LABELS.map(({ id, label }) => {
        const active = id === step;
        return (
          <li
            key={id}
            className={`flex h-[26px] items-center gap-2 rounded-full px-3 text-[12px] font-semibold leading-[14px] ${
              active
                ? 'bg-primary text-white'
                : 'border border-[#F2ECE7] bg-white/[0.16] text-[#6E6168]'
            }`}
          >
            <span>{id}</span>
            <span>{label}</span>
          </li>
        );
      })}
    </ol>

    {children}
  </section>
);

export default SignupCard;