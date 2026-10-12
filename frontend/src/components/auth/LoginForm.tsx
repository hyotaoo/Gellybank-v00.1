import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Input from '@/components/common/Input';
import Button from '@/components/common/Button';
import PasswordField from '@/components/auth/PasswordField';

interface LoginLocationState {
  registered?: boolean;
}

const LoginForm = () => {
  const [password, setPassword] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const registered = (location.state as LoginLocationState | null)?.registered;

  return (
    <form
      className="flex w-full flex-col gap-4 rounded-[36px] bg-surface-card px-[54px] py-[35px]"
      onSubmit={(event) => {
        event.preventDefault();
        navigate('/dashboard');
      }}
    >
      <h2 className="text-[24px] font-bold leading-[1.21] text-ink">Login</h2>

      {registered && (
        <p
          role="status"
          className="rounded-[16px] bg-surface-input px-4 py-2.5 text-[13px] leading-[1.21] text-ink"
        >
          Account created and verified. You can sign in now.
        </p>
      )}

      <label className="flex flex-col gap-2">
        <span className="text-[14px] font-medium leading-[1.21] text-ink">Email address</span>
        <Input type="email" placeholder="name@example.com" autoComplete="email" name="email" />
      </label>

      <PasswordField
        label="Password"
        name="password"
        value={password}
        onChange={setPassword}
        autoComplete="current-password"
      />

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
