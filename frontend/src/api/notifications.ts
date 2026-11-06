import { apiRequest } from '@/api/client';

export type NotificationKind = 'transaction' | 'security' | 'account' | 'insight' | 'system';

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  kind: NotificationKind;
  href?: string | null;
  read: boolean;
  createdAt: string;
}

interface ListNotificationsParams {
  limit?: number;
  unreadOnly?: boolean;
}

export const listNotifications = (
  params: ListNotificationsParams = {},
  signal?: AbortSignal,
): Promise<AppNotification[]> => {
  const query = new URLSearchParams();
  if (params.limit) query.set('limit', String(params.limit));
  if (params.unreadOnly) query.set('unreadOnly', 'true');
  const suffix = query.toString() ? `?${query.toString()}` : '';

  return apiRequest<AppNotification[]>(`/notifications${suffix}`, { signal });
};

export const markNotificationRead = (id: string): Promise<AppNotification> =>
  apiRequest<AppNotification>(`/notifications/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: { read: true },
  });

export const markAllNotificationsRead = (): Promise<{ updated: number }> =>
  apiRequest<{ updated: number }>('/notifications/read-all', { method: 'PATCH' });
