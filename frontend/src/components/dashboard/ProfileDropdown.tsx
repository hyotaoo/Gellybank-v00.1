import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError, setAuthToken } from '@/api/client';
import { getProfile } from '@/api/profile';
import type { Profile } from '@/api/profile';
import CustomerAvatar from '@/components/common/CustomerAvatar';
import CopyButton from '@/components/common/CopyButton';
import ChevronDownIcon from '@/components/icons/ChevronDownIcon';
import HelpCircleIcon from '@/components/icons/HelpCircleIcon';
import LogOutIcon from '@/components/icons/LogOutIcon';
import ProfileIcon from '@/components/icons/ProfileIcon';
import { useAccounts } from '@/context/AccountContext';
import { formatAccountNumber } from '@/utils/format';

const SUPPORT_EMAIL = 'support@gellybank.com';

const rowClass =
  'flex h-[54.52px] w-full items-center gap-[10.73px] rounded-[16px] px-[10.73px] text-left text-[18px] leading-[1.21] text-ink transition-colors hover:bg-surface-card/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-hover';

const ProfileDropdown = () => {
  const { selectedAccount } = useAccounts();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const controllerRef = useRef<AbortController>();
  const navigate = useNavigate();

  const { firstName, middleName, lastName } = profile ?? {
    firstName: '',
    middleName: null,
    lastName: '',
  };
  const displayName = [firstName, middleName, lastName].filter(Boolean).join(' ') || null;

  useEffect(() => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    getProfile(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setProfile(data);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        // The header still renders; the name simply stays blank on failure.
        if (!(err instanceof ApiError) || err.status !== 401) {
          if ((err as Error).name !== 'AbortError') console.error(err);
        }
      });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    const handleProfileUpdate = (event: Event) => {
      setProfile((event as CustomEvent<Profile>).detail);
    };
    window.addEventListener('gellybank:profile-updated', handleProfileUpdate);
    return () => window.removeEventListener('gellybank:profile-updated', handleProfileUpdate);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handlePointer = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  const accountNumber = selectedAccount
    ? formatAccountNumber(selectedAccount.accountNumber)
    : '—';

  const handleSignOut = () => {
    setAuthToken(null, 'customer');
    navigate('/login');
  };

  return (
    <div ref={containerRef} className="relative min-w-0">
      <button
        type="button"
        aria-label="Profile menu"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex min-w-0 items-center gap-3 rounded-[16px] py-[7.15px] pl-[10.73px] pr-[33px] text-left transition-colors hover:bg-surface-card/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-hover sm:gap-4"
      >
        <CustomerAvatar
          firstName={firstName}
          middleName={middleName}
          lastName={lastName}
          avatar={profile?.avatar}
          className="h-[61px] w-[61px] text-[20px]"
        />
        <div className="hidden min-w-0 flex-col sm:flex">
          <span className="truncate text-[20px] font-semibold leading-[1.21] text-ink">
            {displayName ?? '—'}
          </span>
          <span className="text-[14px] leading-[1.21] text-muted">
            Account No. {accountNumber}
          </span>
        </div>
        <ChevronDownIcon
          aria-hidden="true"
          className={`h-5 w-5 flex-none text-muted transition-transform ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Profile"
          className="absolute right-0 z-50 mt-3 flex w-[340px] max-w-[calc(100vw-32px)] flex-col gap-3 rounded-[24px] border border-surface-line bg-[#FDF7F9] p-4 shadow-[0_20px_40px_rgba(159,91,113,0.19)]"
        >
          <div className="flex h-[54.52px] items-center gap-[10.73px] rounded-[16px] px-[10.73px]">
            <CustomerAvatar
              firstName={firstName}
              middleName={middleName}
              lastName={lastName}
              avatar={profile?.avatar}
              className="h-10 w-10 text-[14px]"
            />
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-[16px] font-semibold leading-[1.21] text-ink">
                {displayName ?? '—'}
              </span>
              <div className="flex items-center gap-1.5">
                <span className="truncate text-[13px] leading-[1.21] text-muted">
                  Account No. {accountNumber}
                </span>
                {selectedAccount && (
                  <CopyButton
                    value={selectedAccount.accountNumber}
                    label="Copy account number"
                    className="p-0.5"
                  />
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setOpen(false);
              navigate('/dashboard/profile');
            }}
            className={rowClass}
          >
            <ProfileIcon aria-hidden="true" className="h-[22px] w-[22px] flex-none text-primary" />
            <span>Profile</span>
          </button>

          <a
            href={`https://mail.google.com/mail/?view=cm&fs=1&to=${SUPPORT_EMAIL}&su=Help%20%26%20Support`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            className={rowClass}
          >
            <HelpCircleIcon aria-hidden="true" className="h-[22px] w-[22px] flex-none text-primary" />
            <span>Help &amp; Support</span>
          </a>

          <button type="button" onClick={handleSignOut} className={rowClass}>
            <LogOutIcon aria-hidden="true" className="h-[22px] w-[22px] flex-none text-primary" />
            <span>Sign out</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default ProfileDropdown;
