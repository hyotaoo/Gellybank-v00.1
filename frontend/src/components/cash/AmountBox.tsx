const sanitizeAmount = (raw: string): string => {
  const cleaned = raw.replace(/[^\d.]/g, '');
  const [whole = '', ...rest] = cleaned.split('.');
  if (rest.length === 0) return whole;
  return `${whole}.${rest.join('').slice(0, 2)}`;
};

interface AmountBoxProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
}

// Figma 45:806 / 20:49 — 624x85 r24 #FCF1F5, pad 25, currency chip 46x39 r28
export const SoftAmountBox = ({ id, value, onChange }: AmountBoxProps) => (
  <div className="flex h-[85px] w-full items-center gap-4 rounded-[24px] bg-surface-card px-[25px]">
    <span className="flex h-[39px] w-[46px] flex-none items-center justify-center rounded-[28px] bg-white text-[20px] font-bold leading-6 text-primary">
      ₱
    </span>
    <input
      id={id}
      value={value}
      onChange={(event) => onChange(sanitizeAmount(event.target.value))}
      inputMode="decimal"
      autoComplete="off"
      placeholder="0.00"
      aria-label="Amount"
      className="min-w-0 flex-1 bg-transparent text-[32px] font-bold leading-[38px] text-ink outline-none placeholder:text-ink/25"
    />
  </div>
);

// Figma 2143:922 — 624x76 r16, border 1.5 primary, PHP right
export const OutlinedAmountBox = ({ id, value, onChange }: AmountBoxProps) => (
  <div className="flex h-[76px] w-full items-center justify-between gap-4 rounded-[16px] border-[1.5px] border-primary bg-white px-5 focus-within:ring-2 focus-within:ring-primary/25">
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <span className="flex-none text-[36px] font-bold leading-[43px] text-ink">₱</span>
      <input
        id={id}
        value={value}
        onChange={(event) => onChange(sanitizeAmount(event.target.value))}
        inputMode="decimal"
        autoComplete="off"
        placeholder="0.00"
        aria-label="Amount"
        className="min-w-0 flex-1 bg-transparent text-[36px] font-bold leading-[43px] text-ink outline-none placeholder:text-ink/25"
      />
    </div>
    <span className="flex-none text-[16px] font-semibold leading-[19px] text-muted">PHP</span>
  </div>
);