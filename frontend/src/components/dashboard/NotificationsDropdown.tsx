import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError } from '@/api/client';
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/api/notifications';
import type { NotificationItem } from '@/api/notifications';
import BellIcon from '@/components/icons/BellIcon';
import { formatDateTime } from '@/utils/format';

const categoryTone: Record<string, string> = {
  transaction: 'bg-emerald-50 text-emerald-600',
  request: 'bg-amber-50 text-amber-700',
  card: 'bg-surface-card text-primary',
  system: 'bg-surface-input text-muted',
};

const categoryLabel: Record<string, string> = {
  transaction: 'Transaction',
  request: 'Request',
  card: 'Card',
  system: 'System',
};

const REFRESH_INTERVAL_MS = 60_000;

const NotificationsDropdown = () => {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const navigate = useNavigate();

  const load = useCallback(async () => {
    try {
      const data = await listNotifications();
      setItems(data.items);
      setUnread(data.unread);
      setError(null);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Unable to load notifications.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    void load();
    const interval = window.setInterval(() => void load(), REFRESH_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [load]);

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

  const openItem = async (notification: NotificationItem) => {
    if (!notification.read) {
      setItems((current) =>
        current.map((item) => (item.id === notification.id ? { ...item, read: true } : item)),
      );
      setUnread((count) => Math.max(0, count - 1));
      try {
        await markNotificationRead(notification.id);
      } catch {
        void load();
      }
    }
    setOpen(false);
    if (notification.link) navigate(notification.link);
  };

  const markAllRead = async () => {
    setItems((current) => current.map((item) => ({ ...item, read: true })));
    setUnread(0);
    try {
      await markAllNotificationsRead();
    } catch {
      void load();
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-label={`Notifications${unread > 0 ? `, ${unread} unread` : ''}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((value) => !value)}
        className="relative flex h-[35px] w-[39px] items-center justify-center text-primary transition-opacity hover:opacity-70 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-hover"
      >
        <BellIcon className="h-[33px] w-[33px]" />
        {unread > 0 && (
          <span
            aria-hidden="true"
            className="absolute right-1 top-0.5 flex h-[16px] min-w-[16px] items-center justify-center rounded-full bg-primary-hover px-1 text-[10px] font-bold leading-none text-white"
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 z-50 mt-3 flex w-[340px] max-w-[calc(100vw-32px)] flex-col overflow-hidden rounded-[20px] border border-surface-line bg-white shadow-[0_16px_40px_rgba(0,0,0,0.12)]"
        >
          <div className="flex items-center justify-between border-b border-surface-line px-4 py-3">
            <span className="text-[15px] font-semibold leading-[1.21]">Notifications</span>
            {unread > 0 && (
              <button
                type="button"
                onClick={() => void markAllRead()}
                className="text-[13px] leading-[1.21] text-primary transition-colors hover:text-primary-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-hover"
              >
                Mark all as read
              </button>
            )}
          </div>

          <div className="max-h-[360px] overflow-y-auto">
            {loading && items.length === 0 ? (
              <p role="status" className="px-4 py-8 text-center text-[13px] leading-[1.21] text-muted">
                Loading notifications…
              </p>
            ) : error ? (
              <p role="alert" className="px-4 py-8 text-center text-[13px] leading-[1.21] text-red-600">
                {error}
              </p>
            ) : items.length === 0 ? (
              <p className="px-4 py-8 text-center text-[13px] leading-[1.21] text-muted">
                No notifications yet. Activity on your accounts will show up here.
              </p>
            ) : (
              <ul className="flex flex-col">
                {items.map((notification) => (
                  <li key={notification.id} className="border-b border-surface-line last:border-b-0">
                    <button
                      type="button"
                      onClick={() => void openItem(notification)}
                      className={`flex w-full flex-col gap-1.5 px-4 py-3 text-left transition-colors hover:bg-surface-card/60 focus:outline-none focus-visible:bg-surface-card/60 ${
                        notification.read ? 'opacity-70' : ''
                      }`}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="flex min-w-0 items-center gap-2">
                          {!notification.read && (
                            <span
                              aria-hidden="true"
                              className="h-2 w-2 flex-none rounded-full bg-primary"
                            />
                          )}
                          <span className="truncate text-[14px] font-semibold leading-[1.21] text-ink">
                            {notification.title}
                          </span>
                        </span>
                        <span
                          className={`flex-none rounded-full px-2 py-0.5 text-[11px] font-semibold leading-[1.21] ${
                            categoryTone[notification.category] ?? categoryTone.system
                          }`}
                        >
                          {categoryLabel[notification.category] ?? 'System'}
                        </span>
                      </span>
                      <span className="line-clamp-2 text-[13px] leading-[1.3] text-muted">
                        {notification.message}
                      </span>
                      <span className="text-[12px] leading-[1.21] text-muted">
                        {notification.createdAt ? formatDateTime(notification.createdAt) : ''}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationsDropdown;
