import type { ReactNode } from 'react';

// Figma 2198:1409 / 2198:1615 / 2143:894 — workspace 1077x884, pad 4/23/40/14, gap 16
export const CashWorkspace = ({ children }: { children: ReactNode }) => (
  <div className="flex h-[884px] w-full gap-4 pb-10 pl-[14px] pr-[23px] pt-1">{children}</div>
);

export const DetailsCard = ({
  children,
  gap = 'gap-3',
  padding = 'px-8 py-6',
  className = '',
}: {
  children: ReactNode;
  gap?: string;
  padding?: string;
  className?: string;
}) => (
  <section
    className={`flex h-full w-[688px] flex-none flex-col ${gap} ${padding} rounded-[36px] border border-surface-line bg-white ${className}`}
  >
    {children}
  </section>
);

export const ReviewPanel = ({ children }: { children: ReactNode }) => (
  <section className="flex h-full w-[337px] flex-none flex-col gap-6 overflow-hidden rounded-[36px] border border-surface-line bg-white p-8">
    {children}
  </section>
);

export const Divider = () => <span className="block h-px w-full flex-none bg-surface-line" />;

export const ReviewHeading = ({
  title,
  description,
  centered = false,
}: {
  title: string;
  description?: string;
  centered?: boolean;
}) => (
  <div className="flex flex-none flex-col gap-3">
    <h2
      className={`text-[30px] font-bold leading-[36px] text-ink ${centered ? 'text-center' : ''}`}
    >
      {title}
    </h2>
    <Divider />
    {description ? (
      <p
        className={`text-[15px] font-normal leading-[18px] text-muted ${
          centered ? 'text-center' : ''
        }`}
      >
        {description}
      </p>
    ) : null}
  </div>
);

export const ReviewSummary = ({
  initials,
  name,
  detail,
}: {
  initials: string;
  name: string;
  detail: string;
}) => (
  <div className="flex flex-none flex-col gap-3 py-2">
    <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blush text-[24px] font-semibold leading-[29px] text-primary">
      {initials}
    </span>
    <div className="flex flex-col items-center gap-1.5">
      <p className="text-center text-[20px] font-semibold leading-[24px] text-ink">{name}</p>
      <p className="text-center text-[15px] font-normal leading-[18px] text-muted">{detail}</p>
    </div>
  </div>
);

export const ReviewRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-center justify-between gap-3">
    <span className="text-[15px] font-normal leading-[18px] text-[#6E6168]">{label}</span>
    <span className="text-right text-[16px] font-semibold leading-[19px] text-ink">{value}</span>
  </div>
);

export const ReviewTotal = ({
  label,
  amount,
  note,
  className = '',
}: {
  label: string;
  amount: string;
  note: string;
  className?: string;
}) => (
  <div className={`flex flex-none flex-col gap-2 rounded-[20px] bg-surface-card p-5 ${className}`}>
    <span className="text-[14px] font-semibold leading-[17px] text-[#6E6168]">{label}</span>
    <span className="text-[36px] font-bold leading-[43px] text-primary">{amount}</span>
    <span className="text-[14px] font-normal leading-[17px] text-[#6E6168]">{note}</span>
  </div>
);

export const SubmitButton = ({
  label,
  disabled = false,
}: {
  label: string;
  disabled?: boolean;
}) => (
  <button
    type="submit"
    disabled={disabled}
    className="flex h-14 w-full flex-none items-center justify-center gap-2.5 rounded-[16px] bg-primary text-[16px] font-semibold leading-[19px] text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
  >
    {label}
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21.5 2.5 2.5 9.8l6.2 2.6 2.6 6.2 10.2-16.1Z" />
      <path d="M8.7 12.4 21.5 2.5" />
    </svg>
  </button>
);

export const SecurityNote = ({ children }: { children: string }) => (
  <p className="flex items-center justify-center gap-1.5 text-[13px] font-normal leading-[16px] text-muted">
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3 5 6v6c0 4.4 3 7.4 7 9 4-1.6 7-4.6 7-9V6Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
    {children}
  </p>
);

export const initialsFor = (value?: string): string =>
  (value ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('') || 'GB';