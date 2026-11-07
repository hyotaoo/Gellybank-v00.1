import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiError, setAuthToken } from '@/api/client';
import { getProfile } from '@/api/profile';
import type { Profile } from '@/api/profile';
import CustomerAvatar from '@/components/common/CustomerAvatar';
import CopyButton from '@/components/common/CopyButton';
import NotificationsDropdown from '@/components/dashboard/NotificationsDropdown';
import ChevronDownIcon from '@/components/icons/ChevronDownIcon';
import LogOutIcon from '@/components/icons/LogOutIcon';
import ProfileIcon from '@/components/icons/ProfileIcon';
import { useAccounts } from '@/context/AccountContext';

interface DashboardHeaderProps {
  title?: string;
}

const last4 = (value?: string): string => {
  if (!value) return '----';
  const digits = value.replace(/\D/g, '');
  return digits.slice(-4) || '----';
};

// Figma 45:175 — header 1077x140, pad 53/30/0/14; 45:177 — user dropdown
const DashboardHeader = ({ title = 'Dashboard' }: DashboardHeaderProps) => {
  const navigate = useNavigate();
  const { selectedAccount } = useAccounts();
  const [profile, setProfile] = useState<Profile | null>(null);
  const controllerRef = useRef<AbortController>();
  const menuRef = useRef<HTMLDivElement>(null);
  const [profileOpen, setProfileOpen] = useState(false);

  const { firstName, middleName, lastName } = profile ?? {
    firstName: '',
    middleName: null,
    lastName: '',
  };
  const displayName =
    [firstName, middleName, lastName].filter(Boolean).join(' ') || 'Account holder';

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
    if (!profileOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setProfileOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setProfileOpen(false);
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [profileOpen]);

  const handleSignOut = () => {
    setProfileOpen(false);
    setAuthToken(null, 'customer');
    navigate('/login');
  };

  return (
    <header className="flex h-[140px] w-full flex-none items-center justify-between pl-[14px] pr-[30px] pt-[53px]">
      <h1 className="pl-[30px] text-[64px] font-light leading-[77px] text-primary">{title}</h1>

      <div className="flex items-center">
        <NotificationsDropdown />

        <span className="ml-[9px] block h-8 w-px flex-none bg-rose-300" aria-hidden="true" />

        <div ref={menuRef} className="relative ml-4">
          <button
            type="button"
            onClick={() => setProfileOpen((current) => !current)}
            aria-expanded={profileOpen}
            aria-haspopup="menu"
            className="flex min-w-0 items-center gap-2.5 rounded-[16px] text-left transition-opacity hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-hover"
          >
            <CustomerAvatar
              firstName={firstName}
              middleName={middleName}
              lastName={lastName}
              avatar={profile?.avatar}
              className="h-[61px] w-[61px] text-[20px]"
            />
            <div className="flex min-w-0 flex-col gap-[3px]">
              <span className="truncate text-[20px] font-semibold leading-[24px] text-ink">
                {displayName}
              </span>
              <span className="flex items-center gap-1 whitespace-nowrap text-[16px] font-light leading-[19px] text-muted">
                Account &#8226;&#8226;&#8226;&#8226; {last4(selectedAccount?.accountNumber)}
                {selectedAccount && (
                  <CopyButton
                    value={selectedAccount.accountNumber}
                    label="Copy account number"
                    className="p-0.5"
                  />
                )}
              </span>
            </div>
            <span className="ml-[11px] flex h-[18px] w-[18px] flex-none items-center justify-center">
              <ChevronDownIcon
                className={`h-[18px] w-[18px] transition-transform ${
                  profileOpen ? 'rotate-180' : ''
                }`}
              />
            </span>
          </button>

          {profileOpen && (
            <div
              role="menu"
              aria-label="Profile menu"
              className="absolute right-0 top-[calc(100%+12px)] z-30 w-[260px] rounded-[20px] border border-surface-line bg-white p-2 shadow-[0_16px_40px_rgba(48,41,44,0.12)]"
            >
              <div className="px-3 py-2">
                <p className="truncate text-[14px] font-semibold leading-[17px] text-ink">
                  {displayName}
                </p>
                <p className="truncate text-[12px] leading-[15px] text-muted">
                  {profile?.email ?? '—'}
                </p>
              </div>

              <span className="my-1 block h-px w-full bg-surface-line" aria-hidden="true" />

              <Link
                role="menuitem"
                to="/dashboard/profile"
                onClick={() => setProfileOpen(false)}
                className="flex items-center gap-3 rounded-[12px] px-3 py-2.5 text-[14px] leading-[17px] text-ink transition-colors hover:bg-surface-card focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-hover"
              >
                <ProfileIcon className="h-4 w-4" />
                Profile
              </Link>

              <button
                type="button"
                role="menuitem"
                onClick={handleSignOut}
                className="flex w-full items-center gap-3 rounded-[12px] px-3 py-2.5 text-left text-[14px] leading-[17px] text-primary transition-colors hover:bg-blush focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-hover"
              >
                <LogOutIcon className="h-4 w-4" />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default DashboardHeader;
