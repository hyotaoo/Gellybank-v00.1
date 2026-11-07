import { useEffect, useRef, useState } from 'react';
import type { Account } from '@/api/accounts';
import ChevronRightIcon from '@/components/icons/ChevronRightIcon';
import WalletIcon from '@/components/icons/WalletIcon';
import { formatAccountNumber, formatCurrency, maskAccountNumber } from '@/utils/format';

interface PickerProps {
  accounts: Account[];
  value: string;
  onChange: (accountId: string) => void;
}

const AccountMenu = ({
  accounts,
  value,
  onChange,
  onClose,
}: PickerProps & { onClose: () => void }) => (
  <>
    <button
      type="button"
      aria-label="Close account list"
      className="fixed inset-0 z-10 cursor-default"
      onClick={onClose}
      tabIndex={-1}
    />
    <ul
      role="listbox"
      className="absolute left-0 right-0 top-[calc(100%_+_8px)] z-20 max-h-[280px] overflow-y-auto rounded-[20px] border border-surface-line bg-white p-2 shadow-[0_18px_40px_rgba(48,41,44,0.12)]"
    >
      {accounts.map((account) => (
        <li key={account.id}>
          <button
            type="button"
            role="option"
            aria-selected={account.id === value}
            onClick={() => {
              onChange(account.id);
              onClose();
            }}
            className={`flex w-full items-center gap-3 rounded-[16px] px-4 py-3 text-left transition-colors ${
              account.id === value ? 'bg-blush' : 'hover:bg-surface-card'
            }`}
          >
            <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-white">
              <WalletIcon className="h-5 w-5 text-primary" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-[15px] font-semibold leading-[19px] text-ink">
                {account.label}
              </span>
              <span className="text-[13px] font-normal leading-[16px] text-muted">
                Account No. {formatAccountNumber(account.accountNumber)}
              </span>
            </span>
            <span className="flex-none text-[14px] font-semibold leading-[17px] text-primary">
              {formatCurrency(account.balance, account.currency)}
            </span>
          </button>
        </li>
      ))}
    </ul>
  </>
);

// Figma 2198:1661 — 624x88 r24 #FCF1F5, wallet 48, chevron 40
export const AccountPickerCard = ({ accounts, value, onChange }: PickerProps) => {
  const [open, setOpen] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);
  const account = accounts.find((entry) => entry.id === value);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  return (
    <div ref={wrapper} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex h-[88px] w-full items-center gap-4 rounded-[24px] bg-surface-card px-5 text-left transition-colors hover:bg-blush/60"
      >
        <span className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-white">
          <WalletIcon className="h-6 w-6 text-primary" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="truncate text-[18px] font-semibold leading-[22px] text-ink">
            {account?.label ?? 'Select an account'}
          </span>
          <span className="truncate text-[14px] font-normal leading-[17px] text-muted">
            Account No. {account ? formatAccountNumber(account.accountNumber) : '----'}
          </span>
        </span>
        <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-white">
          <ChevronRightIcon className="h-5 w-5 text-ink" />
        </span>
      </button>
      {open ? (
        <AccountMenu
          accounts={accounts}
          value={value}
          onChange={onChange}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </div>
  );
};

// Figma 2143:902 — 624x77 r20, 44 icon, balance right 20/600 pink
export const SourceAccountCard = ({ accounts, value, onChange }: PickerProps) => {
  const [open, setOpen] = useState(false);
  const account = accounts.find((entry) => entry.id === value);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  return (
    <div className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex h-[77px] w-full items-center gap-4 rounded-[20px] border border-surface-line bg-surface-card px-4 text-left transition-colors hover:bg-blush/60"
      >
        <span className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-white">
          <WalletIcon className="h-6 w-6 text-primary" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-[14px] font-normal leading-[17px] text-[#6E6168]">Transfer from</span>
          <span className="truncate text-[18px] font-normal leading-[22px] text-ink">
            {account ? `GellyBank ${account.label} ${maskAccountNumber(account.accountNumber)}` : 'Select an account'}
          </span>
        </span>
        <span className="flex flex-none flex-col items-end gap-1">
          <span className="text-[14px] font-normal leading-[17px] text-[#6E6168]">Available balance</span>
          <span className="text-[20px] font-semibold leading-[24px] text-primary">
            {account ? formatCurrency(account.balance, account.currency) : '—'}
          </span>
        </span>
      </button>
      {open ? (
        <AccountMenu
          accounts={accounts}
          value={value}
          onChange={onChange}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </div>
  );
};