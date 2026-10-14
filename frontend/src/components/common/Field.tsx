import type { ReactNode } from 'react';

interface FieldProps {
  label: string;
  error?: string;
  helper?: string;
  children: ReactNode;
}

const Field = ({ label, error, helper, children }: FieldProps) => (
  <label className="flex flex-col gap-2">
    <span className="text-[14px] font-medium leading-[1.21] text-ink">{label}</span>
    {children}
    {error ? (
      <span className="text-[12px] leading-[1.21] text-red-600">{error}</span>
    ) : helper ? (
      <span className="text-[12px] leading-[1.21] text-muted">{helper}</span>
    ) : null}
  </label>
);

export default Field;
