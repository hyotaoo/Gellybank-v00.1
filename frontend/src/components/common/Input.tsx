import { forwardRef } from 'react';
import type { InputHTMLAttributes } from 'react';

type InputProps = InputHTMLAttributes<HTMLInputElement>;

const Input = forwardRef<HTMLInputElement, InputProps>(({ className = '', ...props }, ref) => (
  <input
    ref={ref}
    className={`h-[43px] w-full rounded-[36px] border border-transparent bg-surface-input px-4 text-[14px] font-medium leading-[1.21] text-ink outline-none transition-colors placeholder:text-ink hover:border-primary hover:bg-surface-card focus:border-primary-hover focus:bg-surface-input disabled:cursor-not-allowed disabled:border-disabled-fg disabled:bg-disabled-bg disabled:text-disabled-fg disabled:placeholder:text-disabled-fg ${className}`}
    {...props}
  />
));

Input.displayName = 'Input';

export default Input;
