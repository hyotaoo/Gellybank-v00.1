import { useMemo } from 'react';
import Select from '@/components/common/Select';
import Input from '@/components/common/Input';
import ChevronDownIcon from '@/components/icons/ChevronDownIcon';
import { COUNTRIES, findCountry } from '@/utils/countries';

interface PhoneFieldProps {
  countryCode: string;
  number: string;
  onCountryChange: (code: string) => void;
  onNumberChange: (value: string) => void;
  error?: string;
}

const PhoneField = ({
  countryCode,
  number,
  onCountryChange,
  onNumberChange,
  error,
}: PhoneFieldProps) => {
  const country = useMemo(() => findCountry(countryCode), [countryCode]);

  return (
    <label className="flex flex-col gap-2">
      <span className="text-[14px] font-medium leading-[1.21] text-ink">Phone</span>
      <span className="flex gap-2">
        <span className="relative w-[132px] flex-none">
          <Select
            value={countryCode}
            onChange={(event) => onCountryChange(event.target.value)}
            aria-label="Country calling code"
            className="pr-8"
          >
            {COUNTRIES.map((item) => (
              <option key={`${item.code}-${item.dial}`} value={item.code}>
                {item.flag} {item.dial}
              </option>
            ))}
          </Select>
          <ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        </span>
        <Input
          value={number}
          onChange={(event) => onNumberChange(event.target.value.replace(/[^\d\s-]/g, ''))}
          placeholder={country.example}
          inputMode="tel"
          autoComplete="tel"
          className="flex-1"
        />
      </span>
      {error ? (
        <span className="text-[12px] leading-[1.21] text-red-600">{error}</span>
      ) : (
        <span className="text-[12px] leading-[1.21] text-muted">
          {country.name} · e.g. {country.dial} {country.example}
        </span>
      )}
    </label>
  );
};

export default PhoneField;
