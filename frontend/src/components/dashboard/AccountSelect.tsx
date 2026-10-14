import Select from '@/components/common/Select';
import type { Account } from '@/api/accounts';
import { formatCurrency, maskAccountNumber } from '@/utils/format';

interface AccountSelectProps {
  label: string;
  accounts: Account[];
  value: string;
  onChange: (value: string) => void;
  helper?: string;
  error?: string;
  excludeId?: string;
  placeholder?: string;
}

const AccountSelect = ({
  label,
  accounts,
  value,
  onChange,
  helper,
  error,
  excludeId,
  placeholder = 'Select an account',
}: AccountSelectProps) => {
  const options = accounts.filter((account) => account.id !== excludeId);

  return (
    <label className="flex flex-col gap-2">
      <span className="text-[14px] font-medium leading-[1.21] text-ink">{label}</span>
      <Select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">{placeholder}</option>
        {options.map((account) => (
          <option key={account.id} value={account.id}>
            {account.label} · {maskAccountNumber(account.accountNumber)} ·{' '}
            {formatCurrency(account.balance, account.currency)}
          </option>
        ))}
      </Select>
      {error ? (
        <span className="text-[12px] leading-[1.21] text-red-600">{error}</span>
      ) : helper ? (
        <span className="text-[12px] leading-[1.21] text-muted">{helper}</span>
      ) : null}
    </label>
  );
};

export default AccountSelect;
