import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '@/api/auth';
import { ApiError, setAuthToken } from '@/api/client';
import EyeIcon from '@/components/icons/EyeIcon';
import eyeOffIcon from '@/assets/teller/eye-off.svg';
import brandDecorationCircle from '@/assets/teller/brand-decoration-circle-large.svg';

const AdminLoginPage = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();

  return (
    <main className="h-[100dvh] w-full overflow-hidden bg-brand-gradient font-sans text-ink">
      <div className="relative mx-auto flex h-full w-full max-w-[1440px] items-center px-5 py-5 sm:px-10 lg:px-0">
        <div
          aria-hidden="true"
          className="absolute inset-y-0 left-0 hidden w-[829px] bg-[#d9d9d9]/20 min-[1440px]:block"
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

        <form
          className="relative z-10 flex w-full max-w-[623px] flex-col justify-between gap-4 rounded-[36px] bg-surface-card px-6 py-8 sm:px-[54px] sm:py-[35px] min-[1440px]:absolute min-[1440px]:left-[103px] min-[1440px]:top-[335px] min-[1440px]:min-h-[352px]"
          onSubmit={async (event: FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            setSubmitting(true);
            setError(undefined);
            try {
              const response = await login({ email, password });
              if (response.user.role !== 'admin') {
                setAuthToken(null);
                setError('Admin access is restricted to administrator accounts.');
                return;
              }
              setAuthToken(response.token);
              navigate('/admin/dashboard');
            } catch (err) {
              setError(err instanceof ApiError ? err.message : 'Unable to sign in. Please try again.');
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
              className="h-[43px] w-full rounded-[36px] border border-transparent bg-[#f8e7b9]/30 px-4 text-[16px] font-medium leading-[1.21] outline-none transition-colors placeholder:text-ink hover:border-primary focus:border-primary-hover"
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
                className="h-[43px] w-full rounded-[36px] border border-transparent bg-[#f8e7b9]/30 px-4 pr-[56px] text-[16px] font-medium leading-[1.21] outline-none transition-colors placeholder:text-ink hover:border-primary focus:border-primary-hover"
              />
              <button
                type="button"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
                onClick={() => setShowPassword((visible) => !visible)}
                className="absolute right-4 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-hover"
              >
                {showPassword ? (
                  <EyeIcon className="h-[22px] w-[22px]" />
                ) : (
                  <img src={eyeOffIcon} width="22" height="22" alt="" />
                )}
              </button>
            </span>
          </label>

          {error && (
            <p role="alert" className="rounded-[16px] bg-red-50 px-4 py-2.5 text-[13px] leading-[1.21] text-red-700">
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

        <div className="absolute left-[880px] top-[423px] hidden w-[497px] text-[64px] font-black leading-[77px] text-white min-[1440px]:block">
          <p>
            Gelly<span className="text-brand-accent">Bank</span>
          </p>
          <p>Admin Portal</p>
        </div>
      </div>
    </main>
  );
};

export default AdminLoginPage;
