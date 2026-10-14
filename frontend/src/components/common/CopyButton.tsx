import { useEffect, useRef, useState } from 'react';
import CircleCheckIcon from '@/components/icons/CircleCheckIcon';
import CopyIcon from '@/components/icons/CopyIcon';

interface CopyButtonProps {
  value: string;
  label?: string;
  tone?: 'default' | 'light';
  className?: string;
}

const toneClasses: Record<NonNullable<CopyButtonProps['tone']>, string> = {
  default: 'text-muted hover:text-primary',
  light: 'text-white/80 hover:text-white',
};

const CopyButton = ({ value, label = 'Copy', tone = 'default', className = '' }: CopyButtonProps) => {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<number>();

  useEffect(() => () => window.clearTimeout(timeoutRef.current), []);

  const copy = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = value;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }

      setCopied(true);
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? 'Copied' : label}
      title={copied ? 'Copied!' : label}
      className={`inline-flex items-center justify-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-hover ${toneClasses[tone]} ${className}`}
    >
      {copied ? (
        <CircleCheckIcon className={`h-[15px] w-[15px] ${tone === 'light' ? 'text-white' : 'text-emerald-600'}`} />
      ) : (
        <CopyIcon className="h-[15px] w-[15px]" />
      )}
    </button>
  );
};

export default CopyButton;
