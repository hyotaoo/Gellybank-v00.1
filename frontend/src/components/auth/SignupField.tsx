import { useState } from 'react';
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';
import ChevronDownIcon from '@/components/icons/ChevronDownIcon';
import EyeIcon from '@/components/icons/EyeIcon';
import EyeOffIcon from '@/components/icons/EyeOffIcon';

// Figma 45:739 — h43, r36, white 90%, no border, 16/300 placeholder at 25%
const CONTROL =
  'h-[43px] w-full rounded-[36px] border-0 bg-white/90 px-4 text-[16px] font-light leading-[19px] text-ink outline-none transition-shadow placeholder:text-ink/25 focus-visible:ring-2 focus-visible:ring-primary/50';

interface SignupFieldProps {
  label: string;
  error?: string;
  className?: string;
  children: ReactNode;
}

export const SignupField = ({ label, error, className = '', children }: SignupFieldProps) => (
  <label className={`flex flex-col gap-2 ${className}`}>
    <span className="text-[16px] font-medium leading-[19px] text-ink">{label}</span>
    {children}
    {error && <span className="text-[11px] leading-[13px] text-red-600">{error}</span>}
  </label>
);

export const SignupInput = ({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) => (
  <input className={`${CONTROL} ${className}`} {...props} />
);

export const SignupSelect = ({
  className = '',
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) => (
  <span className="relative block">
    <select className={`${CONTROL} cursor-pointer appearance-none pr-10 ${className}`} {...props}>
      {children}
    </select>
    <ChevronDownIcon className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/60" />
  </span>
);

interface SignupPasswordProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'> {
  value: string;
  onChange: (value: string) => void;
}

export const SignupPassword = ({
  value,
  onChange,
  className = '',
  ...props
}: SignupPasswordProps) => {
  const [visible, setVisible] = useState(false);

  return (
    <span className="relative block">
      <input
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`${CONTROL} pr-14 ${className}`}
        {...props}
      />
      <button
        type="button"
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
        onClick={() => setVisible((current) => !current)}
        className="absolute right-4 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-ink transition-colors hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
      >
        {visible ? (
          <EyeIcon className="h-[18px] w-[18px]" />
        ) : (
          <EyeOffIcon className="h-[18px] w-[18px]" />
        )}
      </button>
    </span>
  );
};