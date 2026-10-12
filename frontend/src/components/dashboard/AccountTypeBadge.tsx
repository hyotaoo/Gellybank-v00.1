import type { AccountType } from '@/api/accounts';

const typeStyles: Record<AccountType, { label: string; className: string }> = {
  savings: { label: 'Savings', className: 'bg-surface-card text-primary' },
  checking: { label: 'Checking', className: 'bg-surface-input text-ink' },
};

interface AccountTypeBadgeProps {
  type: AccountType;
  className?: string;
}

const AccountTypeBadge = ({ type, className = '' }: AccountTypeBadgeProps) => {
  const { label, className: tone } = typeStyles[type];

  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-[13px] font-semibold leading-[1.21] ${tone} ${className}`}
    >
      {label}
    </span>
  );
};

export default AccountTypeBadge;
