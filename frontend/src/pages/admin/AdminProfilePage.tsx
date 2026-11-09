import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { ApiError } from '@/api/client';
import { changePassword } from '@/api/auth';
import { getAdminProfile, updateAdminProfile } from '@/api/admin';
import type { AdminProfile } from '@/api/admin';
import { password as passwordValidator } from '@/utils/validation';
import Button from '@/components/common/Button';
import Field from '@/components/common/Field';
import Input from '@/components/common/Input';

const InfoRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex flex-col gap-1">
    <span className="text-xs text-muted">{label}</span>
    <span className="text-sm font-medium text-ink">{value}</span>
  </div>
);

const AdminProfilePage = () => {
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingName, setSavingName] = useState(false);
  const [nameMessage, setNameMessage] = useState<string>();
  const [profileError, setProfileError] = useState<string>();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<string>();
  const [passwordError, setPasswordError] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    getAdminProfile()
      .then((data) => {
        if (cancelled) return;
        setProfile(data);
        setDisplayName(data.displayName ?? data.name);
      })
      .catch((err) =>
        setProfileError(err instanceof ApiError ? err.message : 'Unable to load your profile.'),
      )
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSaveName = async (event: FormEvent) => {
    event.preventDefault();
    setSavingName(true);
    setProfileError(undefined);
    setNameMessage(undefined);
    try {
      const data = await updateAdminProfile(displayName.trim());
      setProfile(data);
      setDisplayName(data.displayName ?? data.name);
      setNameMessage('Display name saved.');
    } catch (err) {
      setProfileError(err instanceof ApiError ? err.message : 'Unable to save the display name.');
    } finally {
      setSavingName(false);
    }
  };

  const handleChangePassword = async (event: FormEvent) => {
    event.preventDefault();
    setPasswordError(undefined);
    setPasswordMessage(undefined);

    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match.');
      return;
    }
    const validationError = passwordValidator(newPassword);
    if (validationError) {
      setPasswordError(validationError);
      return;
    }

    setSavingPassword(true);
    try {
      const result = await changePassword({ currentPassword, newPassword });
      setPasswordMessage(result.message || 'Password updated.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPasswordError(
        err instanceof ApiError ? err.message : 'Unable to change the password.',
      );
    } finally {
      setSavingPassword(false);
    }
  };

  if (loading) {
    return (
      <p role="status" className="text-sm text-muted">
        Loading your profile…
      </p>
    );
  }

  if (!profile) {
    return (
      <section className="flex flex-col gap-4">
        <h1 className="text-3xl font-semibold text-primary">Admin profile</h1>
        {profileError && <p role="alert" className="text-sm text-red-700">{profileError}</p>}
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-6">
      <header>
        <h1 className="text-3xl font-semibold text-primary">Admin profile</h1>
      </header>

      {profileError && <p role="alert" className="text-sm text-red-700">{profileError}</p>}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-surface-line bg-white p-6">
          <h2 className="text-lg font-semibold text-ink">Identity</h2>
          <form className="mt-4 flex flex-col gap-4" onSubmit={handleSaveName}>
            <Field label="Display name" helper="Shown instead of your email across the portal.">
              <Input
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                maxLength={100}
                required
              />
            </Field>
            {nameMessage && <p role="status" className="text-sm text-green-700">{nameMessage}</p>}
            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={savingName}
                className="h-[44px] px-5 text-[14px] font-semibold"
              >
                {savingName ? 'Saving…' : 'Save display name'}
              </Button>
            </div>
          </form>
          <div className="mt-6 grid grid-cols-2 gap-4 border-t border-surface-line pt-4">
            <InfoRow label="Email" value={profile.email} />
            <InfoRow label="Role" value={profile.role} />
            <InfoRow label="Status" value={profile.status} />
            <InfoRow
              label="Email verified"
              value={profile.emailVerified ? 'Yes' : 'No'}
            />
            <InfoRow
              label="Last login"
              value={profile.lastLoginAt ? new Date(profile.lastLoginAt).toLocaleString() : '—'}
            />
            <InfoRow
              label="Member since"
              value={profile.createdAt ? new Date(profile.createdAt).toLocaleDateString() : '—'}
            />
          </div>
        </div>

        <div className="rounded-2xl border border-surface-line bg-white p-6">
          <h2 className="text-lg font-semibold text-ink">Change password</h2>
          <form className="mt-4 flex flex-col gap-4" onSubmit={handleChangePassword}>
            <Field label="Current password">
              <Input
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                autoComplete="current-password"
                required
              />
            </Field>
            <Field label="New password">
              <Input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                autoComplete="new-password"
                required
              />
            </Field>
            <Field label="Confirm new password">
              <Input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
                required
              />
            </Field>
            {passwordError && <p role="alert" className="text-sm text-red-700">{passwordError}</p>}
            {passwordMessage && (
              <p role="status" className="text-sm text-green-700">{passwordMessage}</p>
            )}
            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={savingPassword}
                className="h-[44px] px-5 text-[14px] font-semibold"
              >
                {savingPassword ? 'Updating…' : 'Update password'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
};

export default AdminProfilePage;
