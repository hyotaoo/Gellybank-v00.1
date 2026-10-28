import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ApiError } from '@/api/client';
import { resetPassword } from '@/api/auth';
import Button from '@/components/common/Button';
import Input from '@/components/common/Input';
import PasswordField from '@/components/auth/PasswordField';

const ResetPasswordPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const fragmentToken = new URLSearchParams(window.location.hash.slice(1)).get('token');
  const token = fragmentToken ?? searchParams.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (password !== confirmation) {
      setError('Passwords do not match.');
      return;
    }
    if (!token) {
      setError('A valid password reset token is required.');
      return;
    }
    setSubmitting(true);
    setError(undefined);
    try {
      await resetPassword(token, password);
      navigate('/login', { replace: true, state: { passwordReset: true } });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to reset your password.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-brand-gradient px-5 py-10 font-sans text-ink">
      <form onSubmit={submit} className="flex w-full max-w-[513px] flex-col gap-5 rounded-[36px] bg-surface-card px-6 py-8 sm:px-[54px]">
        <h1 className="text-2xl font-bold">Reset password</h1>
        {!token && <p role="alert" className="text-sm text-red-700">The reset link is missing its token.</p>}
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <PasswordField label="New password" value={password} onChange={setPassword} autoComplete="new-password" required />
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium">Confirm new password</span>
          <Input
            type="password"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            autoComplete="new-password"
            required
          />
        </label>
        <Button type="submit" disabled={submitting || !token} className="h-14 w-full justify-center text-lg">
          {submitting ? 'Updating…' : 'Update password'}
        </Button>
        <Link to="/login" className="text-center text-sm font-semibold text-primary hover:underline">Back to sign in</Link>
      </form>
    </main>
  );
};

export default ResetPasswordPage;
