import { useState } from 'react';
import type { FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Input from '@/components/common/Input';
import Button from '@/components/common/Button';
import PasswordField from '@/components/auth/PasswordField';
import { ApiError, GUEST_SESSION_TOKEN, setAuthToken } from '@/api/client';
import { login } from '@/api/auth';

interface LoginLocationState {
  registered?: boolean;
}

const LoginForm = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const registered = (location.state as LoginLocationState | null)?.registered;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;

    setError(undefined);
    setSubmitting(true);
    try {
      const { token } = await login({ email: email.trim(), password });
      setAuthToken(token);
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to sign in. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      className="flex w-full flex-col gap-4 rounded-[36px] bg-surface-card px-[54px] py-[35px]"
      onSubmit={handleSubmit}
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

      {error && (
        <p
          role="alert"
          className="rounded-[16px] bg-red-50 px-4 py-2.5 text-[13px] leading-[1.21] text-red-600"
        >
          {error}
        </p>
      )}

      <label className="flex flex-col gap-2">
        <span className="text-[14px] font-medium leading-[1.21] text-ink">Email address</span>
        <Input
          type="email"
          placeholder="name@example.com"
          autoComplete="email"
          name="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
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
        disabled={submitting}
        className="h-[56px] w-full justify-center text-[18px] font-medium leading-[1.21]"
      >
        {submitting ? 'Signing in…' : 'Sign in'}
      </Button>

      <button
        type="button"
        onClick={() => {
          setAuthToken(GUEST_SESSION_TOKEN);
          navigate('/dashboard');
        }}
        className="h-[48px] w-full rounded-full border border-surface-line bg-white text-[15px] font-semibold text-ink transition-colors hover:border-primary hover:bg-surface-input focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-hover"
      >
        Continue as guest
      </button>

      <a href="#" className="w-fit text-[14px] font-medium leading-[1.21] text-ink hover:underline">
        Forgot Password
      </a>
    </form>
  );
};

export default LoginForm;
