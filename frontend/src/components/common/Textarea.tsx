import { forwardRef } from 'react';
import type { TextareaHTMLAttributes } from 'react';

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className = '', ...props }, ref) => (
    <textarea
      ref={ref}
      className={`min-h-[80px] w-full resize-none rounded-[24px] border border-transparent bg-surface-input px-4 py-3 text-[14px] font-medium leading-[1.21] text-ink outline-none transition-colors placeholder:text-ink/50 hover:border-primary hover:bg-surface-card focus:border-primary-hover focus:bg-surface-input disabled:cursor-not-allowed disabled:border-disabled-fg disabled:bg-disabled-bg disabled:text-disabled-fg ${className}`}
      {...props}
    />
  ),
);

Textarea.displayName = 'Textarea';

export default Textarea;
