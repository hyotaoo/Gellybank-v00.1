import { useState } from 'react';
import type { FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { login, resendVerification } from '@/api/auth';
import { ApiError, setAuthToken } from '@/api/client';
import Input from '@/components/common/Input';
import Button from '@/components/common/Button';
import PasswordField from '@/components/auth/PasswordField';

interface LoginLocationState {
  registered?: boolean;
  passwordReset?: boolean;
}

const LoginForm = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();
  const [needsVerification, setNeedsVerification] = useState(false);
  const [notice, setNotice] = useState<string>();
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as LoginLocationState | null;
  const registered = locationState?.registered;

  return (
    <form
      className="flex w-full flex-col gap-4 rounded-[36px] bg-surface-card px-6 py-8 sm:px-[54px] sm:py-[35px]"
      onSubmit={async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setSubmitting(true);
        setError(undefined);
        setNotice(undefined);
        setNeedsVerification(false);
        try {
          const response = await login({ email, password });
          if (response.user.role !== 'customer') {
            setAuthToken(null, 'customer');
            setError('This sign-in page is for customer accounts.');
            return;
          }
          setAuthToken(response.token, 'customer');
          navigate('/dashboard');
        } catch (err) {
          if (err instanceof ApiError && err.code === 'email_not_verified') {
            setNeedsVerification(true);
          }
          setError(err instanceof ApiError ? err.message : 'Unable to sign in. Please try again.');
        } finally {
          setSubmitting(false);
        }
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
      {locationState?.passwordReset && (
        <p role="status" className="rounded-[16px] bg-surface-input px-4 py-2.5 text-[13px] leading-[1.21] text-ink">
          Password updated. Sign in with your new password.
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-[16px] bg-red-50 px-4 py-2.5 text-[13px] leading-[1.21] text-red-700">
          {error}
        </p>
      )}
      {needsVerification && (
        <button
          type="button"
          className="self-start text-[13px] font-semibold text-primary hover:underline"
          onClick={async () => {
            setError(undefined);
            try {
              await resendVerification(email);
              setNotice('A new verification code has been sent to your email.');
              setNeedsVerification(false);
            } catch (err) {
              setError(err instanceof ApiError ? err.message : 'Unable to resend the code. Please try again.');
            }
          }}
        >
          Resend verification email
        </button>
      )}
      {notice && (
        <p role="status" className="rounded-[16px] bg-surface-input px-4 py-2.5 text-[13px] leading-[1.21] text-ink">
          {notice}
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
        required
      />

      <Button
        type="submit"
        disabled={submitting}
        variant="primary"
        className="h-[56px] w-full justify-center text-[18px] font-medium leading-[1.21]"
      >
        {submitting ? 'Signing in…' : 'Sign in'}
      </Button>

      <a href="#" className="w-fit text-[14px] font-medium leading-[1.21] text-ink hover:underline">
        Forgot Password
      </a>
    </form>
  );
};

export default LoginForm;
