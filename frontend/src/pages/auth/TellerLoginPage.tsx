import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import EyeIcon from '@/components/icons/EyeIcon';
import eyeOffIcon from '@/assets/teller/eye-off.svg';
import brandDecorationCircle from '@/assets/teller/brand-decoration-circle-large.svg';

const TellerLoginPage = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  return (
    <main className="h-[100dvh] w-full overflow-hidden bg-brand-gradient font-sans text-ink">
      <div className="relative mx-auto flex h-full w-full max-w-[1440px] items-center px-5 py-5 sm:px-10 lg:px-0">
        <div aria-hidden="true" className="absolute inset-y-0 left-0 hidden w-[822px] bg-[#d9d9d9]/20 lg:block" />

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
          className="relative z-10 flex w-full max-w-[565px] flex-col gap-4 rounded-[36px] bg-surface-card px-6 py-8 sm:px-[54px] sm:py-[35px] lg:absolute lg:left-[128px] lg:top-[318px] lg:h-[400px]"
          onSubmit={(event) => {
            event.preventDefault();
            navigate('/dashboard');
          }}
        >
          <h1 className="text-[24px] font-bold leading-none">Login</h1>

          <label className="flex h-[68px] flex-col gap-2">
            <span className="text-[16px] font-bold leading-none">Email address</span>
            <input
              required
              type="email"
              name="email"
              autoComplete="email"
              placeholder="name@example.com"
              className="h-[43px] w-full rounded-[36px] border border-transparent bg-surface-input px-4 text-[16px] font-medium leading-none outline-none transition-colors placeholder:text-ink/50 hover:border-primary focus:border-primary-hover"
            />
          </label>

          <label className="flex h-[68px] flex-col gap-2">
            <span className="text-[16px] font-bold leading-none">Password</span>
            <span className="relative block">
              <input
                required
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                placeholder="••••••••"
                className="h-[43px] w-full rounded-[36px] border border-transparent bg-surface-input px-4 pr-[56px] text-[16px] font-medium leading-none outline-none transition-colors placeholder:text-ink/50 hover:border-primary focus:border-primary-hover"
              />
              <button
                type="button"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
                onClick={() => setShowPassword((visible) => !visible)}
                className="absolute right-0 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-hover"
              >
                {showPassword ? (
                  <EyeIcon className="h-[22px] w-[22px]" />
                ) : (
                  <img src={eyeOffIcon} width="22" height="22" alt="" />
                )}
              </button>
            </span>
          </label>

          <button
            type="submit"
            className="h-[56px] w-full rounded-[20px] bg-primary text-[18px] font-medium leading-none transition-colors hover:bg-primary-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-hover focus-visible:ring-offset-2"
          >
            Sign in
          </button>

          <p className="flex items-center gap-1 text-[16px] leading-none">
            <span className="font-bold">Forgot Password?</span>
            <a href="mailto:support@gellybank.com" className="font-medium text-primary hover:underline">
              Request Password Reset
            </a>
          </p>
        </form>

        <div className="absolute left-[858px] top-[344px] hidden w-[497px] text-[96px] font-black leading-none text-white lg:block">
          <p>
            Gelly<span className="text-brand-accent">Bank</span>
          </p>
          <p>Teller Portal</p>
        </div>
      </div>
    </main>
  );
};

export default TellerLoginPage;
