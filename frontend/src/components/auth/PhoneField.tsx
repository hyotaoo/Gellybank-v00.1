import { findCountry } from '@/utils/countries';

interface PhoneFieldProps {
  number: string;
  onNumberChange: (value: string) => void;
  error?: string;
}

const PHILIPPINES = findCountry('PH');

const PhoneField = ({ number, onNumberChange, error }: PhoneFieldProps) => (
  <label className="flex flex-col gap-2">
    <span className="text-[14px] font-medium leading-[1.21] text-ink">Phone</span>
    <span className="flex h-[43px] items-center rounded-[36px] border border-transparent bg-surface-input pl-4 text-[14px] font-medium leading-[1.21] text-ink transition-colors hover:border-primary focus-within:border-primary-hover">
      <span className="shrink-0">{PHILIPPINES.dial}</span>
      <span aria-hidden="true" className="mx-3 h-5 w-px shrink-0 bg-ink/20" />
      <input
        value={number}
        onChange={(event) =>
          onNumberChange(
            event.target.value
              .replace(/\D/g, '')
              .replace(/^63/, '')
              .replace(/^0/, '')
              .slice(0, PHILIPPINES.max),
          )
        }
        placeholder={PHILIPPINES.example}
        inputMode="numeric"
        autoComplete="tel"
        className="h-full min-w-0 flex-1 bg-transparent pr-4 text-[14px] font-medium leading-[1.21] text-ink outline-none placeholder:text-ink/50"
      />
    </span>
    {error ? (
      <span className="text-[12px] leading-[1.21] text-red-600">{error}</span>
    ) : (
      <span className="text-[12px] leading-[1.21] text-muted">
        {PHILIPPINES.name} · e.g. {PHILIPPINES.dial} {PHILIPPINES.example}
      </span>
    )}
  </label>
);

export default PhoneField;
