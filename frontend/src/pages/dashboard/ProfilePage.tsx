import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError, setAuthToken } from '@/api/client';
import { changePassword } from '@/api/auth';
import { listCards } from '@/api/cards';
import type { BankCard } from '@/api/cards';
import { getProfile, updateProfile } from '@/api/profile';
import type { Profile } from '@/api/profile';
import { createRequest } from '@/api/requests';
import type { TransactionRequest } from '@/api/requests';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import RequestSubmittedModal from '@/components/dashboard/RequestSubmittedModal';
import ScrollArea from '@/components/common/ScrollArea';
import Button from '@/components/common/Button';
import CustomerAvatar from '@/components/common/CustomerAvatar';
import AvatarCropModal from '@/components/common/AvatarCropModal';
import Field from '@/components/common/Field';
import Input from '@/components/common/Input';
import Textarea from '@/components/common/Textarea';
import PasswordField from '@/components/auth/PasswordField';
import { PASSWORD_HINT, confirmMatch, name, optionalName, password } from '@/utils/validation';

interface PersonalState {
  firstName: string;
  middleName: string;
  lastName: string;
}

interface ContactState {
  phone: string;
  address: string;
}

interface PasswordState {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

const emptyPersonal: PersonalState = { firstName: '', middleName: '', lastName: '' };
const emptyContact: ContactState = { phone: '', address: '' };
const emptyPassword: PasswordState = { currentPassword: '', newPassword: '', confirmPassword: '' };

const card = 'rounded-[24px] border border-surface-line bg-white p-5 sm:p-6';

const SectionTitle = ({ children }: { children: string }) => (
  <h2 className="text-[18px] font-semibold leading-[1.21] text-ink">{children}</h2>
);

const formatExpiry = (value: string | null): string => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getFullYear()).slice(-2)}`;
};

const isExpired = (card: BankCard): boolean => {
  if (!card.expiresOn) return false;
  const date = new Date(card.expiresOn);
  return !Number.isNaN(date.getTime()) && date < new Date();
};

const ProfilePage = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile>();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string>();

  const [personal, setPersonal] = useState<PersonalState>(emptyPersonal);
  const [personalErrors, setPersonalErrors] = useState<Partial<PersonalState>>({});
  const [savingPersonal, setSavingPersonal] = useState(false);

  const [contact, setContact] = useState<ContactState>(emptyContact);
  const [savingContact, setSavingContact] = useState(false);

  const [passwords, setPasswords] = useState<PasswordState>(emptyPassword);
  const [passwordErrors, setPasswordErrors] = useState<Partial<PasswordState>>({});
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string>();

  const [notice, setNotice] = useState<string>();
  const [error, setError] = useState<string>();

  const [debitCard, setDebitCard] = useState<BankCard | null>(null);
  const [cardsLoading, setCardsLoading] = useState(true);
  const [cardBusyId, setCardBusyId] = useState<string>();
  const [submitted, setSubmitted] = useState<TransactionRequest | null>(null);

  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarError, setAvatarError] = useState<string>();
  const [cropFile, setCropFile] = useState<File | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      setLoading(true);
      setLoadError(undefined);
      try {
        const data = await getProfile(controller.signal);
        setProfile(data);
        setPersonal({
          firstName: data.firstName,
          middleName: data.middleName ?? '',
          lastName: data.lastName,
        });
        setContact({ phone: data.phone ?? '', address: data.address ?? '' });
      } catch (err) {
        if (controller.signal.aborted) return;
        setLoadError(err instanceof ApiError ? err.message : 'Unable to load your profile.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void load();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    listCards(undefined, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setDebitCard(data[0] ?? null);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setError(err instanceof ApiError ? err.message : 'Unable to load your cards.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setCardsLoading(false);
      });
    return () => controller.abort();
  }, []);

  const applyProfile = (updated: Profile) => {
    setProfile(updated);
    window.dispatchEvent(new CustomEvent<Profile>('gellybank:profile-updated', { detail: updated }));
  };

  const handleAvatarChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setAvatarError(undefined);
    setNotice(undefined);
    setError(undefined);

    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setAvatarError('Choose a PNG, JPG, or WebP image.');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setAvatarError('Choose an image up to 20 MB.');
      return;
    }

    setCropFile(file);
  };

  const handleCroppedAvatar = async (avatar: string) => {
    setCropFile(null);
    setAvatarError(undefined);
    setAvatarBusy(true);
    try {
      const updated = await updateProfile({ avatar });
      applyProfile(updated);
      setNotice('Profile photo updated.');
    } catch (err) {
      setAvatarError(err instanceof ApiError ? err.message : 'Unable to update your profile photo.');
    } finally {
      setAvatarBusy(false);
    }
  };

  const handleRemoveAvatar = async () => {
    setAvatarError(undefined);
    setNotice(undefined);
    setError(undefined);
    setAvatarBusy(true);
    try {
      const updated = await updateProfile({ avatar: null });
      applyProfile(updated);
      setNotice('Profile photo removed.');
    } catch (err) {
      setAvatarError(err instanceof ApiError ? err.message : 'Unable to remove your profile photo.');
    } finally {
      setAvatarBusy(false);
    }
  };

  const handlePersonalSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotice(undefined);
    setError(undefined);

    const nextErrors: Partial<PersonalState> = {
      firstName: name('First name')(personal.firstName),
      middleName: optionalName('Middle name')(personal.middleName),
      lastName: name('Last name')(personal.lastName),
    };
    setPersonalErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;

    setSavingPersonal(true);
    try {
      const updated = await updateProfile({
        firstName: personal.firstName.trim(),
        middleName: personal.middleName.trim(),
        lastName: personal.lastName.trim(),
      });
      applyProfile(updated);
      setNotice('Personal information updated.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to update your personal information.');
    } finally {
      setSavingPersonal(false);
    }
  };

  const handleContactSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotice(undefined);
    setError(undefined);

    setSavingContact(true);
    try {
      const updated = await updateProfile({
        phone: contact.phone.trim(),
        address: contact.address.trim(),
      });
      applyProfile(updated);
      setNotice('Contact details updated.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to update your contact details.');
    } finally {
      setSavingContact(false);
    }
  };

  const handlePasswordSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotice(undefined);
    setError(undefined);
    setPasswordError(undefined);

    const nextErrors: Partial<PasswordState> = {
      currentPassword: passwords.currentPassword ? undefined : 'Current password is required.',
      newPassword: password(passwords.newPassword, profile?.email),
      confirmPassword: confirmMatch(passwords.newPassword)(passwords.confirmPassword),
    };
    setPasswordErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;

    setSavingPassword(true);
    try {
      await changePassword({
        currentPassword: passwords.currentPassword,
        newPassword: passwords.newPassword,
      });
      setAuthToken(null, 'customer');
      navigate('/login', { replace: true });
    } catch (err) {
      setPasswordError(err instanceof ApiError ? err.message : 'Unable to change your password.');
    } finally {
      setSavingPassword(false);
    }
  };

  const handleReplaceExpired = async (card: BankCard) => {
    setNotice(undefined);
    setError(undefined);
    setCardBusyId(card.id);
    try {
      const request = await createRequest({
        accountId: card.accountId,
        type: 'card',
        note: 'Expired card replacement',
      });
      setSubmitted(request);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to request a replacement card.');
    } finally {
      setCardBusyId(undefined);
    }
  };

  const handleReportLost = async (card: BankCard) => {
    setNotice(undefined);
    setError(undefined);
    setCardBusyId(card.id);
    try {
      const request = await createRequest({
        accountId: card.accountId,
        type: 'card_lost',
        note: 'Lost card reported',
      });
      setSubmitted(request);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to report this card as lost.');
    } finally {
      setCardBusyId(undefined);
    }
  };

  return (
    <DashboardLayout title="Profile">
      <ScrollArea
        className="lg:pr-1"
        wrapperClassName="flex min-h-0 flex-1 flex-col"
        contentClassName="flex flex-col gap-6 pb-2"
        trackInsetTop={0}
        trackInsetBottom={8}
      >
        <p className="text-sm text-muted"></p>

        {error && <p role="alert" className="text-[13px] leading-[1.21] text-red-600">{error}</p>}
        {notice && <p role="status" className="text-[13px] leading-[1.21] text-emerald-700">{notice}</p>}

        {loading ? (
          <p role="status" className="text-[14px] text-muted">Loading profile…</p>
        ) : loadError ? (
          <p role="alert" className="text-[14px] text-red-600">{loadError}</p>
        ) : profile ? (
          <>
            <section className={`${card} flex flex-col gap-4 sm:flex-row sm:items-center`}>
              <CustomerAvatar
                firstName={profile.firstName}
                middleName={profile.middleName}
                lastName={profile.lastName}
                avatar={profile.avatar}
                className="h-[72px] w-[72px] text-[26px]"
              />
              <div className="flex min-w-0 flex-col gap-3">
                <SectionTitle>Profile photo</SectionTitle>
                <div className="flex flex-wrap gap-2">
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={handleAvatarChange}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={avatarBusy}
                    onClick={() => avatarInputRef.current?.click()}
                    className="h-[40px] px-4 text-[13px]"
                  >
                    {avatarBusy ? 'Uploading…' : profile.avatar ? 'Change photo' : 'Upload photo'}
                  </Button>
                  {profile.avatar && (
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={avatarBusy}
                      onClick={() => void handleRemoveAvatar()}
                      className="h-[40px] px-4 text-[13px]"
                    >
                      Remove photo
                    </Button>
                  )}
                </div>
                {avatarError && (
                  <p role="alert" className="text-[13px] leading-[1.21] text-red-600">
                    {avatarError}
                  </p>
                )}
              </div>
            </section>

            <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <form onSubmit={handlePersonalSubmit} className={`${card} flex flex-col gap-4`} noValidate>
              <SectionTitle>Personal information</SectionTitle>
              <p className="text-[13px] leading-[1.21] text-muted">
                View and update the personal information allowed on your account.
              </p>

              <Field label="First name" error={personalErrors.firstName}>
                <Input
                  value={personal.firstName}
                  onChange={(event) => {
                    setPersonal((previous) => ({ ...previous, firstName: event.target.value }));
                    setPersonalErrors((previous) => ({ ...previous, firstName: undefined }));
                  }}
                  autoComplete="given-name"
                />
              </Field>

              <Field label="Middle name (optional)" error={personalErrors.middleName}>
                <Input
                  value={personal.middleName}
                  onChange={(event) => {
                    setPersonal((previous) => ({ ...previous, middleName: event.target.value }));
                    setPersonalErrors((previous) => ({ ...previous, middleName: undefined }));
                  }}
                  autoComplete="additional-name"
                />
              </Field>

              <Field label="Last name" error={personalErrors.lastName}>
                <Input
                  value={personal.lastName}
                  onChange={(event) => {
                    setPersonal((previous) => ({ ...previous, lastName: event.target.value }));
                    setPersonalErrors((previous) => ({ ...previous, lastName: undefined }));
                  }}
                  autoComplete="family-name"
                />
              </Field>

              <Field label="Email address" helper="Email changes are not available on this page.">
                <Input value={profile.email} disabled autoComplete="email" />
              </Field>

              <div>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={savingPersonal}
                  className="h-[44px] justify-center px-6 text-[14px] font-semibold"
                >
                  {savingPersonal ? 'Saving…' : 'Save personal information'}
                </Button>
              </div>
            </form>

            <div className="flex flex-col gap-5">
              <form onSubmit={handleContactSubmit} className={`${card} flex flex-col gap-4`} noValidate>
                <SectionTitle>Contact details</SectionTitle>
                <p className="text-[13px] leading-[1.21] text-muted">
                  Keep your phone number and home address up to date.
                </p>

                <Field label="Phone number">
                  <Input
                    type="tel"
                    value={contact.phone}
                    onChange={(event) => setContact((previous) => ({ ...previous, phone: event.target.value }))}
                    autoComplete="tel"
                    placeholder="+63 900 000 0000"
                  />
                </Field>

                <Field label="Home address">
                  <Textarea
                    value={contact.address}
                    onChange={(event) => setContact((previous) => ({ ...previous, address: event.target.value }))}
                    autoComplete="street-address"
                    placeholder="Street, Barangay, City, Province, Postal code"
                  />
                </Field>

                <div>
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={savingContact}
                    className="h-[44px] justify-center px-6 text-[14px] font-semibold"
                  >
                    {savingContact ? 'Saving…' : 'Save contact details'}
                  </Button>
                </div>
              </form>

              <section className={`${card} flex flex-col gap-3`}>
                <SectionTitle>Verification status</SectionTitle>
                <dl className="flex flex-col gap-3 text-[14px]">
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-muted">Email address</dt>
                    <dd
                      className={`rounded-full px-3 py-1 text-[12px] font-semibold ${
                        profile.emailVerified
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      {profile.emailVerified ? 'Verified' : 'Not verified'}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-muted">Account status</dt>
                    <dd className="rounded-full bg-surface-card px-3 py-1 text-[12px] font-semibold text-ink">
                      {profile.customerStatus}
                    </dd>
                  </div>
                </dl>
              </section>
            </div>

            <section className={`${card} flex flex-col gap-4 xl:col-span-2`}>
              <SectionTitle>Debit card</SectionTitle>
              <p className="text-[13px] leading-[1.21] text-muted">
                View your card and request a replacement for an expired or lost card.
              </p>

              {cardsLoading ? (
                <p role="status" className="text-[14px] text-muted">Loading card…</p>
              ) : !debitCard ? (
                <p className="text-[14px] text-muted">You don&apos;t have a card yet.</p>
              ) : (
                <div className="flex flex-col gap-3 rounded-[18px] border border-surface-line p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-[15px] font-semibold capitalize leading-[1.21] text-ink">
                        {debitCard.type} card •••• {debitCard.last4 ?? '••••'}
                      </span>
                      <span
                        className={`rounded-full px-3 py-1 text-[12px] font-semibold capitalize ${
                          debitCard.status === 'active'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {debitCard.status}
                      </span>
                    </div>
                    <dl className="flex flex-wrap gap-x-6 gap-y-1 text-[13px] leading-[1.21]">
                      <div className="flex gap-1">
                        <dt className="text-muted">Expiry</dt>
                        <dd>{formatExpiry(debitCard.expiresOn)}</dd>
                      </div>
                      <div className="flex gap-1">
                        <dt className="text-muted">Account</dt>
                        <dd>{debitCard.accountNumber}</dd>
                      </div>
                      <div className="flex gap-1">
                        <dt className="text-muted">Holder</dt>
                        <dd>{debitCard.holder || '—'}</dd>
                      </div>
                    </dl>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {isExpired(debitCard) && (
                      <Button
                        type="button"
                        variant="primary"
                        disabled={cardBusyId === debitCard.id}
                        onClick={() => void handleReplaceExpired(debitCard)}
                        className="h-[40px] px-4 text-[13px]"
                      >
                        Replace expired card
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={cardBusyId === debitCard.id}
                      onClick={() => void handleReportLost(debitCard)}
                      className="h-[40px] px-4 text-[13px]"
                    >
                      Report lost card
                    </Button>
                  </div>
                </div>
              )}
            </section>

            <form onSubmit={handlePasswordSubmit} className={`${card} flex flex-col gap-4 xl:col-span-2`} noValidate>
              <SectionTitle>Security settings</SectionTitle>
              <p className="text-[13px] leading-[1.21] text-muted">
                Change your password. You will be signed out and asked to sign in again.
              </p>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <PasswordField
                  label="Current password"
                  value={passwords.currentPassword}
                  onChange={(value) => {
                    setPasswords((previous) => ({ ...previous, currentPassword: value }));
                    setPasswordErrors((previous) => ({ ...previous, currentPassword: undefined }));
                  }}
                  autoComplete="current-password"
                  error={passwordErrors.currentPassword}
                />
                <PasswordField
                  label="New password"
                  value={passwords.newPassword}
                  onChange={(value) => {
                    setPasswords((previous) => ({ ...previous, newPassword: value }));
                    setPasswordErrors((previous) => ({ ...previous, newPassword: undefined }));
                  }}
                  autoComplete="new-password"
                  error={passwordErrors.newPassword}
                  hint={PASSWORD_HINT}
                />
                <PasswordField
                  label="Confirm new password"
                  value={passwords.confirmPassword}
                  onChange={(value) => {
                    setPasswords((previous) => ({ ...previous, confirmPassword: value }));
                    setPasswordErrors((previous) => ({ ...previous, confirmPassword: undefined }));
                  }}
                  autoComplete="new-password"
                  error={passwordErrors.confirmPassword}
                />
              </div>

              {passwordError && <p role="alert" className="text-[13px] leading-[1.21] text-red-600">{passwordError}</p>}

              <div>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={savingPassword}
                  className="h-[44px] justify-center px-6 text-[14px] font-semibold"
                >
                  {savingPassword ? 'Changing password…' : 'Change password'}
                </Button>
              </div>
            </form>
          </div>
          </>
        ) : null}
      </ScrollArea>

      {cropFile && (
        <AvatarCropModal
          file={cropFile}
          onCancel={() => setCropFile(null)}
          onSave={(dataUrl) => void handleCroppedAvatar(dataUrl)}
        />
      )}
      {submitted && (
        <RequestSubmittedModal request={submitted} onClose={() => setSubmitted(null)} />
      )}
    </DashboardLayout>
  );
};

export default ProfilePage;
