import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { AppNotification } from '@/api/notifications';
import { getAuthUser, setAuthUser } from '@/api/auth';
import { setAuthToken } from '@/api/client';
import avatar from '@/assets/avatar.png';
import BellIcon from '@/components/icons/BellIcon';
import ChevronDownIcon from '@/components/icons/ChevronDownIcon';
import ChevronRightIcon from '@/components/icons/ChevronRightIcon';
import LogOutIcon from '@/components/icons/LogOutIcon';
import ProfileIcon from '@/components/icons/ProfileIcon';
import NotificationItem from '@/components/dashboard/NotificationItem';
import { useAccounts } from '@/context/AccountContext';
import { useNotifications } from '@/context/NotificationContext';

const FALLBACK_NAME = 'JHAMEL ROSE SUMAGUE';

type HeaderMenu = 'profile' | 'notifications' | null;

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
  const {
    notifications,
    unreadCount,
    loading: notificationsLoading,
    error: notificationsError,
    markRead,
    markAllRead,
    refresh: refreshNotifications,
  } = useNotifications();
  const accountNumber = last4(selectedAccount?.accountNumber);
  const user = getAuthUser();
  const displayName =
    [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim() || FALLBACK_NAME;
  const [openMenu, setOpenMenu] = useState<HeaderMenu>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!openMenu) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpenMenu(null);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenMenu(null);
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [openMenu]);

  const handleSignOut = () => {
    setOpenMenu(null);
    setAuthToken(null);
    setAuthUser(null);
    navigate('/login');
  };

  const handleNotificationSelect = async (notification: AppNotification) => {
    setOpenMenu(null);
    await markRead(notification.id);
    if (notification.href) navigate(notification.href);
  };

  return (
    <header className="flex h-[140px] w-full flex-none items-center justify-between pl-[14px] pr-[30px] pt-[53px]">
      <h1 className="pl-[30px] text-[64px] font-light leading-[77px] text-primary">{title}</h1>

      <div ref={menuRef} className="flex items-center">
        <span className="w-6 flex-none" aria-hidden="true" />

        <div className="relative">
          <button
            type="button"
            onClick={() =>
              setOpenMenu((current) =>
                current === 'notifications' ? null : 'notifications',
              )
            }
            aria-expanded={openMenu === 'notifications'}
            aria-haspopup="menu"
            aria-label={
              unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'
            }
            className="relative flex h-[35px] w-[39px] items-center justify-center transition-opacity hover:opacity-70 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-hover"
          >
            <BellIcon className="h-[33px] w-[33px]" />
            {unreadCount > 0 && (
              <span className="absolute right-0 top-0 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border border-white bg-primary px-1 text-[10px] font-semibold leading-none text-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {openMenu === 'notifications' && (
            <div
              role="menu"
              aria-label="Notifications"
              className="absolute right-0 top-[calc(100%+14px)] z-40 w-[380px] rounded-[20px] border border-surface-line bg-white p-2 shadow-[0_16px_40px_rgba(48,41,44,0.12)]"
            >
              <div className="flex items-start justify-between gap-3 px-3 pb-2 pt-2.5">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <p className="text-[16px] font-semibold leading-[20px] text-ink">
                    Notifications
                  </p>
                  <p className="text-[12px] leading-[15px] text-muted">
                    {unreadCount > 0 ? `${unreadCount} unread` : 'You are all caught up'}
                  </p>
                </div>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={() => void markAllRead()}
                    className="rounded-full px-2 py-1 text-[12px] font-semibold leading-[15px] text-primary transition-colors hover:bg-blush focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-hover"
                  >
                    Mark all read
                  </button>
                )}
              </div>

              <span className="my-1 block h-px w-full bg-surface-line" aria-hidden="true" />

              {notificationsLoading && notifications.length === 0 ? (
                <div className="flex h-[120px] items-center justify-center text-[13px] text-muted">
                  Loading notifications&#8230;
                </div>
              ) : notificationsError && notifications.length === 0 ? (
                <div className="flex flex-col items-center gap-2 px-3 py-5 text-center">
                  <p className="text-[13px] leading-[17px] text-muted">{notificationsError}</p>
                  <button
                    type="button"
                    onClick={() => void refreshNotifications()}
                    className="text-[12px] font-semibold text-primary transition-colors hover:text-primary-hover"
                  >
                    Try again
                  </button>
                </div>
              ) : notifications.length === 0 ? (
                <div className="flex h-[120px] flex-col items-center justify-center gap-2 px-3 text-center">
                  <BellIcon className="h-7 w-7 text-primary" />
                  <p className="text-[13px] leading-[17px] text-muted">
                    No notifications yet.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-0.5">
                  {notifications.slice(0, 4).map((notification) => (
                    <NotificationItem
                      key={notification.id}
                      notification={notification}
                      onSelect={handleNotificationSelect}
                      compact
                    />
                  ))}
                </div>
              )}

              <span className="my-1 block h-px w-full bg-surface-line" aria-hidden="true" />

              <Link
                role="menuitem"
                to="/dashboard/notifications"
                onClick={() => setOpenMenu(null)}
                className="flex items-center justify-between rounded-[12px] px-3 py-2.5 text-[13px] font-semibold leading-[16px] text-primary transition-colors hover:bg-blush focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-hover"
              >
                View all notifications
                <ChevronRightIcon className="h-4 w-4" />
              </Link>
            </div>
          )}
        </div>

        <span className="ml-[9px] block h-8 w-px flex-none bg-rose-300" aria-hidden="true" />

        <div className="relative ml-4">
          <button
            type="button"
            onClick={() =>
              setOpenMenu((current) => (current === 'profile' ? null : 'profile'))
            }
            aria-expanded={openMenu === 'profile'}
            aria-haspopup="menu"
            className="flex min-w-0 items-center gap-2.5 rounded-[16px] text-left transition-opacity hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-hover"
          >
            <img
              src={avatar}
              alt={displayName}
              className="h-[61px] w-[61px] flex-none rounded-full border-2 border-primary object-cover"
            />
            <div className="flex min-w-0 flex-col gap-[3px]">
              <span className="truncate text-[20px] font-semibold leading-[24px] text-ink">
                {displayName}
              </span>
              <span className="whitespace-nowrap text-[16px] font-light leading-[19px] text-muted">
                Account &#8226;&#8226;&#8226;&#8226; {accountNumber}
              </span>
            </div>
            <span className="ml-[11px] flex h-[18px] w-[18px] flex-none items-center justify-center">
              <ChevronDownIcon
                className={`h-[18px] w-[18px] transition-transform ${
                  openMenu === 'profile' ? 'rotate-180' : ''
                }`}
              />
            </span>
          </button>

          {openMenu === 'profile' && (
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
                  {user?.email ?? 'demo@gellybank.com'}
                </p>
              </div>

              <span className="my-1 block h-px w-full bg-surface-line" aria-hidden="true" />

              <Link
                role="menuitem"
                to="/dashboard/profile"
                onClick={() => setOpenMenu(null)}
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
