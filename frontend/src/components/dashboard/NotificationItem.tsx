import type { AppNotification, NotificationKind } from '@/api/notifications';
import AiInsightsIcon from '@/components/icons/AiInsightsIcon';
import BankIcon from '@/components/icons/BankIcon';
import BellIcon from '@/components/icons/BellIcon';
import HistoryIcon from '@/components/icons/HistoryIcon';
import ShieldCheckIcon from '@/components/icons/ShieldCheckIcon';
import { formatRelativeTime } from '@/utils/format';

const kindCopy: Record<
  NotificationKind,
  { icon: typeof BellIcon; tone: string }
> = {
  transaction: { icon: HistoryIcon, tone: 'bg-blush text-primary' },
  security: { icon: ShieldCheckIcon, tone: 'bg-[#EDF6EE] text-[#43814C]' },
  account: { icon: BankIcon, tone: 'bg-[#FFF7DF] text-[#8B6C27]' },
  insight: { icon: AiInsightsIcon, tone: 'bg-[#F2ECE7] text-[#6E6168]' },
  system: { icon: BellIcon, tone: 'bg-surface-card text-primary' },
};

interface NotificationItemProps {
  notification: AppNotification;
  onSelect: (notification: AppNotification) => void;
  compact?: boolean;
}

const NotificationItem = ({
  notification,
  onSelect,
  compact = false,
}: NotificationItemProps) => {
  const info = kindCopy[notification.kind] ?? kindCopy.system;
  const Icon = info.icon;

  return (
    <button
      type="button"
      onClick={() => onSelect(notification)}
      className={`flex w-full items-start gap-3 rounded-[16px] text-left transition-colors hover:bg-surface-card focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-hover ${
        compact ? 'px-3 py-2.5' : 'px-4 py-3.5'
      } ${notification.read ? 'bg-white' : 'bg-surface-card/60'}`}
    >
      <span
        className={`flex flex-none items-center justify-center rounded-full ${
          compact ? 'h-9 w-9' : 'h-10 w-10'
        } ${info.tone}`}
      >
        <Icon className={compact ? 'h-[18px] w-[18px]' : 'h-5 w-5'} />
      </span>

      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex items-start gap-2">
          <span
            className={`min-w-0 flex-1 truncate font-semibold leading-[18px] text-ink ${
              compact ? 'text-[13px]' : 'text-[15px]'
            }`}
          >
            {notification.title}
          </span>
          {!notification.read && (
            <span
              className="mt-1.5 h-2 w-2 flex-none rounded-full bg-primary"
              aria-label="Unread"
            />
          )}
        </span>

        <span
          className={`text-[#6E6168] ${
            compact ? 'line-clamp-2 text-[12px] leading-[15px]' : 'text-[13px] leading-[17px]'
          }`}
        >
          {notification.message}
        </span>

        <span className="text-[11px] leading-[14px] text-muted">
          {formatRelativeTime(notification.createdAt)}
        </span>
      </span>
    </button>
  );
};

export default NotificationItem;
