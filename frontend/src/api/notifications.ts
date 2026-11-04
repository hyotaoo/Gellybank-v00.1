import { apiRequest } from '@/api/client';

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

export const listNotifications = (signal?: AbortSignal): Promise<NotificationList> =>
  apiRequest<NotificationList>('/notifications', { signal });

export const markNotificationRead = (id: string): Promise<NotificationItem> =>
  apiRequest<NotificationItem>(`/notifications/${encodeURIComponent(id)}/read`, {
    method: 'POST',
  });

export const markAllNotificationsRead = (): Promise<{ updated: number }> =>
  apiRequest<{ updated: number }>('/notifications/read-all', { method: 'POST' });
