interface AmountFieldProps {
  value: string;
  onChange: (value: string) => void;
  helper?: string;
  error?: string;
  allowDecimals?: boolean;
}

const sanitize = (raw: string, allowDecimals: boolean): string => {
  const cleaned = raw.replace(/[^\d.]/g, '');
  if (!allowDecimals) return cleaned.replace(/\./g, '');
  const [whole, ...rest] = cleaned.split('.');
  return rest.length ? `${whole}.${rest.join('').slice(0, 2)}` : whole;
};

const AmountField = ({ value, onChange, helper, error, allowDecimals = true }: AmountFieldProps) => (
  <label className="flex flex-col gap-2">
    <span className="text-[14px] font-medium leading-[1.21] text-ink">Amount</span>
    <span className="relative block">
      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[14px] font-semibold text-muted">
        ₱
      </span>
      <input
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(event) => onChange(sanitize(event.target.value, allowDecimals))}
        placeholder="0.00"
        className="h-[43px] w-full rounded-[36px] border border-transparent bg-surface-input pl-8 pr-4 text-[14px] font-medium leading-[1.21] text-ink outline-none transition-colors placeholder:text-ink/50 hover:border-primary hover:bg-surface-card focus:border-primary-hover focus:bg-surface-input"
      />
    </span>
    {error ? (
      <span className="text-[12px] leading-[1.21] text-red-600">{error}</span>
    ) : helper ? (
      <span className="text-[12px] leading-[1.21] text-muted">{helper}</span>
    ) : null}
  </label>
);

export default AmountField;
