import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '@/api/auth';
import { ApiError, setAuthToken } from '@/api/client';
import EyeIcon from '@/components/icons/EyeIcon';
import EyeOffIcon from '@/components/icons/EyeOffIcon';
import brandDecorationCircle from '@/assets/teller/brand-decoration-circle-large.svg';
import { BrandName } from '@/context/BankSettingsContext';

const TellerLoginPage = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  return (
    <main className="h-[100dvh] w-full overflow-hidden bg-brand-gradient font-sans text-ink">
      <div className="relative mx-auto flex h-full w-full max-w-[1440px] flex-col items-center justify-center gap-8 px-5 py-5 sm:px-10 lg:flex-row lg:gap-12 lg:px-12 min-[1440px]:grid min-[1440px]:max-w-none min-[1440px]:grid-cols-[57.57%_1fr] min-[1440px]:gap-0 min-[1440px]:px-0">
        <div
          aria-hidden="true"
          className="absolute inset-y-0 left-0 hidden w-[57.57%] bg-[#d9d9d9]/20 min-[1440px]:block"
        />

        <img
          aria-hidden="true"
          src={brandDecorationCircle}
          className="pointer-events-none absolute -right-[69px] -top-[52px]"
          width="427"
          height="390"
          alt=""
        />
        <img
          aria-hidden="true"
          src={brandDecorationCircle}
          className="pointer-events-none absolute -bottom-[198px] -left-[54px]"
          width="427"
          height="390"
          alt=""
        />

        {/* Title: top on mobile, right side on desktop */}
        <div className="relative z-10 w-full text-center text-[44px] font-black leading-[1.2] text-white sm:text-[56px] lg:order-2 lg:w-auto lg:flex-1 lg:text-[64px] min-[1440px]:px-12">
          <p>
            <BrandName tailClassName="text-brand-accent" />
          </p>
          <p>Teller Portal</p>
        </div>

        {/* Form: below title on mobile, left side on desktop */}
        <form
          className="relative z-10 flex w-full max-w-[623px] flex-col justify-between gap-4 rounded-[36px] bg-surface-card px-6 py-8 sm:px-[54px] sm:py-[35px] lg:order-1 lg:flex-1 min-[1440px]:min-h-[352px] min-[1440px]:justify-self-center"
          onSubmit={async (event: FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            setSubmitting(true);
            setError(undefined);
            setShowForgotPassword(false);
            try {
              const response = await login({ email, password });
              if (response.user.role !== 'teller') {
                setAuthToken(null, 'teller');
                setError('Teller access is restricted to teller accounts.');
                return;
              }
              setAuthToken(response.token, 'teller');
              navigate('/teller/dashboard');
            } catch (err) {
              setError(err instanceof ApiError ? err.message : 'Unable to sign in. Please try again.');
              if (err instanceof ApiError && err.code === 'invalid_credentials') {
                setShowForgotPassword(true);
              }
            } finally {
              setSubmitting(false);
            }
          }}
        >
          <h1 className="text-[24px] font-bold leading-[1.21]">Login</h1>

          <label className="flex flex-col gap-2">
            <span className="text-[16px] font-bold leading-[1.21]">Email address</span>
            <input
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              name="email"
              autoComplete="email"
              placeholder="name@example.com"
              className="h-[43px] w-full rounded-[36px] border border-transparent bg-surface-input px-4 text-[16px] font-medium leading-[1.21] outline-none transition-colors placeholder:text-ink/50 hover:border-primary focus:border-primary-hover"
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-[16px] font-bold leading-[1.21]">Password</span>
            <span className="relative block">
              <input
                required
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                placeholder="••••••••"
                className="h-[43px] w-full rounded-[36px] border border-transparent bg-surface-input px-4 pr-[56px] text-[16px] font-medium leading-[1.21] outline-none transition-colors placeholder:text-ink/50 hover:border-primary focus:border-primary-hover"
              />
              <button
                type="button"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
                onClick={() => setShowPassword((visible) => !visible)}
                className="absolute right-4 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center text-ink transition-colors hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-hover"
              >
                {showPassword ? (
                  <EyeIcon className="h-[18px] w-[18px]" />
                ) : (
                  <EyeOffIcon className="h-[18px] w-[18px]" />
                )}
              </button>
            </span>
          </label>

          {showForgotPassword && (
            <a
              href="mailto:support@gellybank.com"
              className="w-fit text-[14px] font-medium leading-[1.21] text-ink hover:text-primary hover:underline"
            >
              Forgot Password
            </a>
          )}

          {error && (
            <p role="alert" className="rounded-[16px] bg-red-50 px-4 py-2.5 text-center text-[13px] leading-[1.21] text-red-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="h-[56px] w-full rounded-[20px] bg-primary text-[18px] font-medium leading-[1.21] transition-colors hover:bg-primary-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-hover focus-visible:ring-offset-2"
          >
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </main>
  );
};

export default TellerLoginPage;
