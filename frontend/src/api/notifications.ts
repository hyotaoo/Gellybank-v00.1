import { apiRequest } from '@/api/client';
import type { TokenScope } from '@/api/client';

export type NotificationCategory = 'transaction' | 'request' | 'card' | 'system';

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  category: NotificationCategory;
  link: string | null;
  read: boolean;
  readAt: string | null;
  createdAt: string | null;
}

export interface NotificationList {
  unread: number;
  items: NotificationItem[];
}

export const listNotifications = (
  signal?: AbortSignal,
  scope?: TokenScope,
): Promise<NotificationList> =>
  apiRequest<NotificationList>('/notifications', { signal, authScope: scope });

export const markNotificationRead = (
  id: string,
  scope?: TokenScope,
): Promise<NotificationItem> =>
  apiRequest<NotificationItem>(`/notifications/${encodeURIComponent(id)}/read`, {
    method: 'POST',
    authScope: scope,
  });

export const markAllNotificationsRead = (scope?: TokenScope): Promise<{ updated: number }> =>
  apiRequest<{ updated: number }>('/notifications/read-all', { method: 'POST', authScope: scope });
