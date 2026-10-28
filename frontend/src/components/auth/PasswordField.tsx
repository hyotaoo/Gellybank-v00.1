import { useState } from 'react';
import Input from '@/components/common/Input';
import EyeIcon from '@/components/icons/EyeIcon';
import EyeOffIcon from '@/components/icons/EyeOffIcon';

interface PasswordFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  name?: string;
  placeholder?: string;
  autoComplete?: string;
  error?: string;
  required?: boolean;
}

const PasswordField = ({
  label,
  value,
  onChange,
  name,
  placeholder = '••••••••',
  autoComplete = 'new-password',
  error,
  required = false,
}: PasswordFieldProps) => {
  const [show, setShow] = useState(false);

  return (
    <label className="flex flex-col gap-2">
      <span className="text-[14px] font-medium leading-[1.21] text-ink">{label}</span>
      <span className="relative block">
        <Input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          name={name}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required={required}
          className="pr-[56px]"
        />
        <button
          type="button"
          aria-label={show ? 'Hide password' : 'Show password'}
          aria-pressed={show}
          onClick={() => setShow((visible) => !visible)}
          className="absolute right-4 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-transparent bg-white text-ink transition-colors hover:border-primary hover:bg-surface-card focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-hover"
        >
          {show ? <EyeIcon className="h-[18px] w-[18px]" /> : <EyeOffIcon className="h-[18px] w-[18px]" />}
        </button>
      </span>
      {error && <span className="text-[12px] leading-[1.21] text-red-600">{error}</span>}
    </label>
  );
};

export default PasswordField;
