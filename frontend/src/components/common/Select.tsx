import { forwardRef } from 'react';
import type { SelectHTMLAttributes } from 'react';

type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

const Select = forwardRef<HTMLSelectElement, SelectProps>(({ className = '', children, ...props }, ref) => (
  <select
    ref={ref}
    className={`h-[43px] w-full cursor-pointer appearance-none rounded-[36px] border border-transparent bg-surface-input px-4 text-[14px] font-medium leading-[1.21] text-ink outline-none transition-colors hover:border-primary hover:bg-surface-card focus:border-primary-hover focus:bg-surface-input disabled:cursor-not-allowed disabled:border-disabled-fg disabled:bg-disabled-bg disabled:text-disabled-fg ${className}`}
    {...props}
  >
    {children}
  </select>
));

Select.displayName = 'Select';

export default Select;
