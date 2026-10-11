import { useState } from 'react';
import Input from '@/components/common/Input';
import Button from '@/components/common/Button';
import EyeIcon from '@/components/icons/EyeIcon';
import EyeOffIcon from '@/components/icons/EyeOffIcon';

const LoginForm = () => {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form
      className="flex w-full flex-col gap-4 rounded-[36px] bg-surface-card px-[54px] py-[35px]"
      onSubmit={(event) => event.preventDefault()}
    >
      <h2 className="text-[24px] font-bold leading-[1.21] text-ink">Login</h2>

      <label className="flex flex-col gap-2">
        <span className="text-[14px] font-medium leading-[1.21] text-ink">Email address</span>
        <Input type="email" placeholder="name@example.com" autoComplete="email" name="email" />
      </label>

      <label className="flex flex-col gap-2">
        <span className="text-[14px] font-medium leading-[1.21] text-ink">Password</span>
        <span className="relative block">
          <Input
            type={showPassword ? 'text' : 'password'}
            placeholder="••••••••"
            autoComplete="current-password"
            name="password"
            className="pr-[56px]"
          />
          <button
            type="button"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            aria-pressed={showPassword}
            onClick={() => setShowPassword((value) => !value)}
            className="absolute right-4 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-transparent bg-white text-ink transition-colors hover:border-primary hover:bg-surface-card focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-hover"
          >
            {showPassword ? (
              <EyeIcon className="h-[18px] w-[18px]" />
            ) : (
              <EyeOffIcon className="h-[18px] w-[18px]" />
            )}
          </button>
        </span>
      </label>

      <Button
        type="submit"
        variant="primary"
        className="h-[56px] w-full justify-center text-[18px] font-medium leading-[1.21]"
      >
        Sign in
      </Button>

      <a href="#" className="w-fit text-[14px] font-medium leading-[1.21] text-ink hover:underline">
        Forgot Password
      </a>
    </form>
  );
};

export default LoginForm;
