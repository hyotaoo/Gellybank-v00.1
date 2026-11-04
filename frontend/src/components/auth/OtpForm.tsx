import { useEffect, useRef, useState } from 'react';
import type { ClipboardEvent, KeyboardEvent } from 'react';
import { resendVerification, verifyEmail } from '@/api/auth';
import { ApiError, setAuthToken } from '@/api/client';
import Button from '@/components/common/Button';

const CODE_LENGTH = 6;
const RESEND_SECONDS = 60;

interface OtpFormProps {
  email: string;
  onVerified: () => void;
  onBack: () => void;
}

const OtpForm = ({ email, onVerified, onBack }: OtpFormProps) => {
  const [digits, setDigits] = useState<string[]>(() => Array(CODE_LENGTH).fill(''));
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const [seconds, setSeconds] = useState(RESEND_SECONDS);
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (seconds <= 0) return;
    const timer = window.setTimeout(() => setSeconds((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [seconds]);

  const focusInput = (index: number) => inputsRef.current[index]?.focus();

  const handleChange = (index: number, raw: string) => {
    const digit = raw.replace(/\D/g, '').slice(-1);
    setError(undefined);
    setDigits((previous) => {
      const next = [...previous];
      next[index] = digit;
      return next;
    });
    if (digit && index < CODE_LENGTH - 1) focusInput(index + 1);
  };

  const handleKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace' && !digits[index] && index > 0) focusInput(index - 1);
  };

  const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const pasted = event.clipboardData
      .getData('text')
      .replace(/\D/g, '')
      .slice(0, CODE_LENGTH);
    if (!pasted) return;
    event.preventDefault();
    setDigits(Array(CODE_LENGTH).fill('').map((_, index) => pasted[index] ?? ''));
    setError(undefined);
    focusInput(Math.min(pasted.length, CODE_LENGTH - 1));
  };

  const resend = async () => {
    setError(undefined);
    setNotice(undefined);
    try {
      await resendVerification(email);
      setDigits(Array(CODE_LENGTH).fill(''));
      setSeconds(RESEND_SECONDS);
      setNotice('A new code is on its way.');
      focusInput(0);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to resend the code. Please try again.');
    }
  };

  const verify = async () => {
    const entered = digits.join('');
    if (entered.length < CODE_LENGTH) {
      setError('Enter the 6-digit code.');
      return;
    }
    setSubmitting(true);
    setError(undefined);
    try {
      const response = await verifyEmail(email, entered);
      setAuthToken(response.token);
      onVerified();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to verify your email. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-[28px] font-bold leading-[1.21] text-ink">Verify your account</h1>
      <p className="text-[14px] leading-[1.21] text-muted">
        Enter the 6-digit code we sent to <span className="font-semibold text-ink">{email}</span>.
      </p>

      <div className="flex justify-between gap-2" onPaste={handlePaste}>
        {Array.from({ length: CODE_LENGTH }).map((_, index) => (
          <input
            key={index}
            ref={(element) => {
              inputsRef.current[index] = element;
            }}
            value={digits[index]}
            onChange={(event) => handleChange(index, event.target.value)}
            onKeyDown={(event) => handleKeyDown(index, event)}
            inputMode="numeric"
            autoComplete={index === 0 ? 'one-time-code' : 'off'}
            maxLength={1}
            aria-label={`Digit ${index + 1}`}
            className="h-[56px] w-[56px] rounded-[16px] border border-transparent bg-surface-input text-center text-[24px] font-bold text-ink outline-none transition-colors focus:border-primary-hover focus:bg-surface-card"
          />
        ))}
      </div>

      {notice && <span className="text-[12px] leading-[1.21] text-primary">{notice}</span>}
      {error && <span className="text-[12px] leading-[1.21] text-red-600">{error}</span>}

      <Button
        type="button"
        variant="primary"
        onClick={verify}
        disabled={submitting}
        className="mt-1 h-[56px] w-full justify-center text-[17px] font-semibold"
      >
        {submitting ? 'Verifying…' : 'Verify account'}
      </Button>

      <div className="flex items-center justify-between text-[13px] leading-[1.21]">
        <button type="button" onClick={onBack} className="font-medium text-ink hover:underline">
          Edit details
        </button>
        {seconds > 0 ? (
          <span className="text-muted">Resend code in {seconds}s</span>
        ) : (
          <button type="button" onClick={resend} className="font-semibold text-primary hover:underline">
            Resend code
          </button>
        )}
      </div>
    </div>
  );
};

export default OtpForm;
