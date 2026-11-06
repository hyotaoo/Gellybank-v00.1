import { useState } from 'react';
import type { FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { login, setAuthUser } from '@/api/auth';
import { ApiError, setAuthToken } from '@/api/client';
import Input from '@/components/common/Input';
import PasswordField from '@/components/auth/PasswordField';

interface LoginLocationState {
  registered?: boolean;
  email?: string;
}

// Figma 45:105 — 513x445, r36, blush 90%, 1px primary, pad 35/54
const LoginForm = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as LoginLocationState | null;
  const registered = locationState?.registered;
  const [email, setEmail] = useState(locationState?.email ?? '');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(undefined);

    try {
      const response = await login({ email, password });
      if (response.user.role !== 'customer') {
        setAuthToken(null);
        setAuthUser(null);
        setError('This sign-in page is for customer accounts.');
        return;
      }

      setAuthToken(response.token);
      setAuthUser(response.user);
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to sign in. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      className="flex w-full flex-col gap-[25px] rounded-[36px] border border-primary bg-page/90 px-[54px] py-[35px]"
      onSubmit={handleSubmit}
    >
      <h2 className="text-[36px] font-semibold leading-[43px] text-ink">Login</h2>

      {registered && (
        <p
          role="status"
          className="rounded-[16px] bg-surface-input px-4 py-2.5 text-[14px] leading-[17px] text-ink"
        >
          Account created and verified. Sign in to track your account application.
        </p>
      )}

      {error && (
        <p
          role="alert"
          className="rounded-[16px] bg-red-50 px-4 py-2.5 text-[14px] leading-[17px] text-red-700"
        >
          {error}
        </p>
      )}

      <label className="flex flex-col gap-2">
        <span className="text-[20px] font-light leading-[24px] text-ink">Email address</span>
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
        required
      />

      <a
        href="#"
        className="-mt-[8px] w-fit self-end text-[12px] font-light leading-[14px] text-ink hover:underline"
      >
        Forgot Password?
      </a>

      <button
        type="submit"
        disabled={submitting}
        className="flex h-[43px] w-[402px] max-w-full items-center justify-center self-center rounded-[37px] border border-rose-300 bg-[radial-gradient(circle_at_50%_51%,rgba(255,242,202,0.5)_0%,#FCE8EE_100%)] text-[20px] font-normal leading-[24px] text-[#331B29]/75 transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
};

export default LoginForm;