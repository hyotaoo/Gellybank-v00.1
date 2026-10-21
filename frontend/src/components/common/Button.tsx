import type { ButtonHTMLAttributes, ReactNode } from 'react';
import useFitScale from '@/hooks/useFitScale';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary';
  children: ReactNode;
  disabled?: boolean;
}

const Button = ({ variant = 'primary', className = '', children, disabled, ...props }: ButtonProps) => {
  const scale = useFitScale();
  const base =
    `inline-flex items-center border border-transparent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-hover focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:border-disabled-fg disabled:bg-disabled-bg disabled:text-disabled-fg transform-scale(${scale})`;
  const variants = {
    primary:
      'rounded-[20px] bg-primary text-ink hover:border-primary hover:bg-primary-hover focus-visible:border-primary-hover',
    secondary:
      'rounded-[36px] bg-surface-card text-ink hover:border-primary hover:bg-primary-hover focus-visible:border-primary-hover',
  };
  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
};

export default Button;
