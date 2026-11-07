import { forwardRef } from 'react';
import type { InputHTMLAttributes } from 'react';

type InputProps = InputHTMLAttributes<HTMLInputElement>;

// Figma 45:750 — h43, r36, white 90%, 1px primary
const Input = forwardRef<HTMLInputElement, InputProps>(({ className = '', ...props }, ref) => (
  <input
    ref={ref}
    className={`h-[43px] w-full rounded-[36px] border border-primary bg-white/90 px-4 text-[16px] font-medium leading-[19px] text-ink outline-none transition-colors placeholder:text-ink/50 hover:border-primary-hover focus:border-primary-hover disabled:cursor-not-allowed disabled:border-disabled-fg disabled:bg-disabled-bg disabled:text-disabled-fg disabled:placeholder:text-disabled-fg ${className}`}
    {...props}
  />
));

Input.displayName = 'Input';

export default Input;