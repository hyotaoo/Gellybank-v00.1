import { useEffect, useRef, useState } from 'react';
import avatar from '@/assets/avatar.png';
import { ApiError } from '@/api/client';
import { getProfile } from '@/api/profile';
import type { Profile } from '@/api/profile';
import CopyButton from '@/components/common/CopyButton';
import NotificationsDropdown from '@/components/dashboard/NotificationsDropdown';
import RequestCardButton from '@/components/dashboard/RequestCardButton';
import { useAccounts } from '@/context/AccountContext';
import { formatAccountNumber } from '@/utils/format';

interface DashboardHeaderProps {
  title?: string;
}

const DashboardHeader = ({ title = 'Dashboard' }: DashboardHeaderProps) => {
  const { selectedAccount } = useAccounts();
  const [profile, setProfile] = useState<Profile | null>(null);
  const controllerRef = useRef<AbortController>();

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

  const accountNumber = selectedAccount
    ? formatAccountNumber(selectedAccount.accountNumber)
    : '—';

  return (
    <header className="flex flex-none flex-col gap-4 px-4 py-6 sm:px-6 md:flex-row md:items-center md:justify-between lg:h-[120px] lg:pl-[14px] lg:pr-[30px] lg:pt-[33px]">
      <h1 className="text-[30px] font-semibold leading-none text-primary sm:text-[36px]">{title}</h1>

      <div className="flex items-center gap-3 sm:gap-6">
        <RequestCardButton />

        <NotificationsDropdown />

        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <img
            src={avatar}
            alt={displayName ?? 'Account holder avatar'}
            className="h-[61px] w-[61px] flex-none rounded-full border border-surface-input object-cover"
          />
          <div className="hidden min-w-0 flex-col sm:flex">
            <span className="truncate text-[20px] font-semibold leading-[1.21] text-ink">
              {displayName ?? '—'}
            </span>
            <div className="flex items-center gap-1.5">
              <span className="text-[14px] leading-[1.21] text-muted">
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
      </div>
    </header>
  );
};

export default DashboardHeader;
