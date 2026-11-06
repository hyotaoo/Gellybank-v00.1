import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AppNotification } from '@/api/notifications';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import NotificationItem from '@/components/dashboard/NotificationItem';
import BellIcon from '@/components/icons/BellIcon';
import CircleCheckIcon from '@/components/icons/CircleCheckIcon';
import { useNotifications } from '@/context/NotificationContext';

type NotificationFilter = 'all' | 'unread';

const NotificationsPage = () => {
  const navigate = useNavigate();
  const {
    notifications,
    unreadCount,
    loading,
    error,
    markRead,
    markAllRead,
    refresh,
  } = useNotifications();
  const [filter, setFilter] = useState<NotificationFilter>('all');

  const visible = useMemo(
    () =>
      filter === 'unread'
        ? notifications.filter((notification) => !notification.read)
        : notifications,
    [notifications, filter],
  );

  const handleSelect = async (notification: AppNotification) => {
    await markRead(notification.id);
    if (notification.href) navigate(notification.href);
  };

  const tabs: { value: NotificationFilter; label: string }[] = [
    { value: 'all', label: `All (${notifications.length})` },
    { value: 'unread', label: `Unread (${unreadCount})` },
  ];

  return (
    <DashboardLayout title="Notifications">
      <div className="flex h-[884px] w-full pb-10 pl-[14px] pr-[23px] pt-1">
        <section className="flex h-full w-[1040px] flex-none flex-col gap-5 overflow-hidden rounded-[36px] border border-surface-line bg-white/90 p-8">
          <div className="flex flex-none items-start justify-between gap-4">
            <div className="flex flex-col gap-2">
              <h2 className="text-[36px] font-semibold leading-[43px] text-ink">
                Notification center
              </h2>
              <p className="text-[15px] font-normal leading-[18px] text-muted">
                Deposits, transfers, security alerts, and account updates in one place.
              </p>
            </div>

            <button
              type="button"
              onClick={() => void markAllRead()}
              disabled={unreadCount === 0}
              className="flex h-[42px] flex-none items-center gap-2 rounded-[16px] bg-surface-card px-4 text-[13px] font-semibold leading-[16px] text-primary transition-colors hover:bg-blush disabled:cursor-not-allowed disabled:opacity-50"
            >
              <CircleCheckIcon className="h-4 w-4" />
              Mark all as read
            </button>
          </div>

          <div className="flex h-[42px] flex-none items-center justify-between">
            <div className="flex h-[42px] items-center gap-1 rounded-[16px] bg-surface-card p-1">
              {tabs.map((tab) => {
                const active = tab.value === filter;
                return (
                  <button
                    key={tab.value}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setFilter(tab.value)}
                    className={`flex h-[34px] items-center rounded-[12px] px-4 text-[14px] font-semibold leading-[17px] transition-colors ${
                      active ? 'bg-white text-primary' : 'text-[#6E6168] hover:text-ink'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
            <span className="text-[14px] font-normal leading-[17px] text-[#6E6168]">
              {visible.length} {visible.length === 1 ? 'notification' : 'notifications'} ·
              Newest first
            </span>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            {loading && notifications.length === 0 ? (
              <div className="flex h-full items-center justify-center text-[14px] text-muted">
                Loading notifications&#8230;
              </div>
            ) : error && notifications.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                <p className="text-[15px] leading-[18px] text-muted">{error}</p>
                <button
                  type="button"
                  onClick={() => void refresh()}
                  className="rounded-full bg-surface-card px-4 py-2 text-[13px] font-semibold text-primary transition-colors hover:bg-blush"
                >
                  Try again
                </button>
              </div>
            ) : visible.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-card text-primary">
                  <BellIcon className="h-8 w-8" />
                </span>
                <p className="text-[20px] font-semibold leading-[24px] text-ink">
                  {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
                </p>
                <p className="max-w-[380px] text-[14px] leading-[18px] text-muted">
                  {filter === 'unread'
                    ? 'You have read everything. New alerts will appear here.'
                    : 'Account activity and security alerts will appear here.'}
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {visible.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onSelect={handleSelect}
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
};

export default NotificationsPage;
