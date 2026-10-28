import { apiRequest } from '@/api/client';

export type AdminRole = 'admin' | 'teller' | 'customer';
export type AdminStatus = 'active' | 'suspended';
export type AuditSeverity = 'INFO' | 'WARN' | 'ERROR';

export interface AdminMetrics {
  totalUsers: number;
  pendingApplications: number;
  totalAccounts: number;
  systemHealth: 'healthy' | 'unavailable';
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  status: AdminStatus;
}

export interface AccountApplication {
  id: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  accountType: 'savings' | 'checking';
  initialDeposit: number;
  label: string | null;
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason: string | null;
  accountId: string | null;
  accountNumber: string | null;
  createdAt: string | null;
  reviewedAt: string | null;
}

export interface AuditLogEntry {
  id: string;
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  severity: AuditSeverity;
  details: Record<string, unknown>;
  ipAddress: string | null;
  createdAt: string | null;
}

export const getAdminDashboard = (signal?: AbortSignal): Promise<AdminMetrics> =>
  apiRequest<AdminMetrics>('/admin/dashboard', { signal });

export const listAdminUsers = (search = '', signal?: AbortSignal): Promise<AdminUser[]> => {
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  return apiRequest<AdminUser[]>(`/admin/users${params.size ? `?${params}` : ''}`, { signal });
};

export const updateAdminUser = (
  id: string,
  input: { role?: AdminRole; isActive?: boolean },
): Promise<AdminUser> =>
  apiRequest<AdminUser>(`/admin/users/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: input,
  });

export const issuePasswordReset = (
  id: string,
): Promise<{ resetToken: string; expiresInSeconds: number }> =>
  apiRequest(`/admin/users/${encodeURIComponent(id)}/password-reset`, { method: 'POST' });

export const listAccountApplications = (
  status: 'pending' | 'approved' | 'rejected' | 'all' = 'pending',
  signal?: AbortSignal,
): Promise<AccountApplication[]> =>
  apiRequest<AccountApplication[]>(`/admin/applications?status=${status}`, { signal });

export const decideAccountApplication = (
  id: string,
  decision: 'approve' | 'reject',
  reason?: string,
): Promise<AccountApplication> =>
  apiRequest<AccountApplication>(
    `/admin/applications/${encodeURIComponent(id)}/decision`,
    { method: 'POST', body: { decision, reason } },
  );

export const listAuditLogs = (
  filters: { severity?: AuditSeverity; actorId?: string },
  signal?: AbortSignal,
): Promise<AuditLogEntry[]> => {
  const params = new URLSearchParams();
  if (filters.severity) params.set('severity', filters.severity);
  if (filters.actorId) params.set('actorId', filters.actorId);
  return apiRequest<AuditLogEntry[]>(`/admin/logs${params.size ? `?${params}` : ''}`, { signal });
};
