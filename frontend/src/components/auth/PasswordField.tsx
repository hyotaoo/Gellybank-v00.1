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

// Figma 45:779 — 405x43 input, 40x40 cream toggle, 2px #F8DB83 ring
const PasswordField = ({
  label,
  value,
  onChange,
  name,
  placeholder = '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022',
  autoComplete = 'new-password',
  error,
  required = false,
}: PasswordFieldProps) => {
  const [show, setShow] = useState(false);

  return (
    <label className="flex flex-col gap-2">
      <span className="text-[20px] font-light leading-[24px] text-ink">{label}</span>
      <span className="relative block">
        <Input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          name={name}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required={required}
          className="border-rose-300 pr-[56px]"
        />
        <button
          type="button"
          aria-label={show ? 'Hide password' : 'Show password'}
          aria-pressed={show}
          onClick={() => setShow((visible) => !visible)}
          className="absolute right-[2px] top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border-2 border-[#F8DB83] bg-cream text-ink transition-colors hover:bg-[#FFEFC2] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-hover"
        >
          {show ? <EyeIcon className="h-[18px] w-[18px]" /> : <EyeOffIcon className="h-[18px] w-[18px]" />}
        </button>
      </span>
      {error && <span className="text-[12px] leading-[14px] text-red-600">{error}</span>}
    </label>
  );
};

export default PasswordField;