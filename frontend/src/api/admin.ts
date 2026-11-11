import { apiDownload, apiRequest, apiUpload } from '@/api/client';
import type { TellerRequest } from '@/api/requests';

export type AdminRole = 'admin' | 'teller' | 'customer';
export type AdminStatus = 'active' | 'suspended';
export type AuditSeverity = 'INFO' | 'WARN' | 'ERROR';

export interface AdminMetrics {
  totalUsers: number;
  totalCustomers: number;
  totalTellers: number;
  totalTransactions: number;
  pendingApplications: number;
  pendingRequests: number;
  totalAccounts: number;
  transactionOverview: {
    today: Partial<Record<'deposit' | 'withdrawal', TypeSummary>>;
    lifetime: Partial<Record<'deposit' | 'withdrawal', TypeSummary>>;
  };
  recentActivity: AuditLogEntry[];
  systemHealth: 'healthy' | 'unavailable';
}

export interface TypeSummary {
  count: number;
  total: number;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  status: AdminStatus;
}

export interface AdminUserDetail extends AdminUser {
  emailVerified: boolean;
  lastLoginAt: string | null;
  createdAt: string | null;
  phone: string | null;
  address: string | null;
  customerStatus: 'active' | 'closed' | null;
  accounts: AdminAccountSummary[];
}

export interface AdminAccount extends AdminAccountSummary {
  type: string;
  interestRate: number;
  isPrimary?: boolean;
  createdAt: string | null;
}

export interface AdminAccountDetail {
  account: AdminAccount;
  recentTransactions: AdminAccountTransaction[];
}

export interface AdminAccountTransaction {
  id: string;
  accountId: string;
  type: string;
  amount: number;
  currency: string;
  balanceAfter: number;
  note: string | null;
  counterparty: string | null;
  reference: string;
  status: string;
  createdAt: string | null;
}

export type AdminAccountAction = 'freeze' | 'unfreeze' | 'close' | 'reopen';

export const listAdminAccounts = (
  filters: { status?: string; search?: string } = {},
  signal?: AbortSignal,
): Promise<AdminAccount[]> => {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  if (filters.search) params.set('search', filters.search);
  return apiRequest<AdminAccount[]>(`/admin/accounts${params.size ? `?${params}` : ''}`, { signal });
};

export const getAdminAccount = (id: string, signal?: AbortSignal): Promise<AdminAccountDetail> =>
  apiRequest<AdminAccountDetail>(`/admin/accounts/${encodeURIComponent(id)}`, { signal });

export const updateAdminAccountStatus = (
  id: string,
  action: AdminAccountAction,
): Promise<AdminAccount> =>
  apiRequest<AdminAccount>(
    `/admin/accounts/${encodeURIComponent(id)}/status`,
    { method: 'PATCH', body: { action } },
  );

export interface AdminAccountSummary {
  id: string;
  accountNumber: string;
  label: string;
  balance: number;
  currency: string;
  status: string;
  customerName: string;
  customerEmail: string;
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

export const listAdminUsers = (
  search = '',
  filters: { role?: AdminRole; status?: AdminStatus } = {},
  signal?: AbortSignal,
): Promise<AdminUser[]> => {
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (filters.role) params.set('role', filters.role);
  if (filters.status) params.set('status', filters.status);
  return apiRequest<AdminUser[]>(`/admin/users${params.size ? `?${params}` : ''}`, { signal });
};

export const getAdminUser = (id: string, signal?: AbortSignal): Promise<AdminUserDetail> =>
  apiRequest<AdminUserDetail>(`/admin/users/${encodeURIComponent(id)}`, { signal });

export const createAdminUser = (input: {
  email: string;
  password: string;
  role: 'teller' | 'admin';
}): Promise<AdminUserDetail> =>
  apiRequest<AdminUserDetail>('/admin/users', { method: 'POST', body: input });

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

export const listAdminCardRequests = (
  status: 'pending' | 'approved' | 'rejected' | 'all' = 'pending',
  signal?: AbortSignal,
): Promise<TellerRequest[]> =>
  apiRequest<TellerRequest[]>(`/admin/card-requests?status=${status}`, { signal });

export const approveAdminCardRequest = (id: string): Promise<TellerRequest> =>
  apiRequest<TellerRequest>(`/admin/card-requests/${encodeURIComponent(id)}/approve`, {
    method: 'POST',
  });

export const rejectAdminCardRequest = (id: string, reason: string): Promise<TellerRequest> =>
  apiRequest<TellerRequest>(`/admin/card-requests/${encodeURIComponent(id)}/reject`, {
    method: 'POST',
    body: { reason },
  });

export interface ReportsSummary {
  accounts: {
    customers: number;
    users: number;
    activeUsers: number;
    accounts: number;
    activeAccounts: number;
    frozenAccounts: number;
    pendingApplications: number;
  };
  lifetimeByType: Record<string, TypeSummary>;
  todayByType: Record<string, TypeSummary>;
  rangeByType: Record<string, TypeSummary>;
  tellerStats: { id: string; name: string; transactions: number; total: number }[];
  customerStats: {
    totalCustomers: number;
    newCustomers: number;
    totalAccounts: number;
    activeAccounts: number;
    frozenAccounts: number;
  };
  deployedBalance: number;
  systemHealth: 'healthy' | 'degraded';
}

export const getAdminReports = (
  range: { from?: string; to?: string } = {},
  signal?: AbortSignal,
): Promise<ReportsSummary> => {
  const params = new URLSearchParams();
  if (range.from) params.set('from', range.from);
  if (range.to) params.set('to', range.to);
  return apiRequest<ReportsSummary>(`/admin/reports${params.size ? `?${params}` : ''}`, { signal });
};

export const exportAdminReports = (range: { from?: string; to?: string } = {}): Promise<Blob> => {
  const params = new URLSearchParams();
  if (range.from) params.set('from', range.from);
  if (range.to) params.set('to', range.to);
  return apiDownload(`/admin/reports/export${params.size ? `?${params}` : ''}`);
};

export interface AdminTransaction {
  id: string;
  accountId: string;
  type: string;
  amount: number;
  currency: string;
  balanceAfter: number;
  note: string | null;
  counterparty: string | null;
  reference: string;
  status: string;
  createdAt: string | null;
  accountNumber: string | null;
  accountLabel: string | null;
  customerName: string | null;
  customerEmail: string | null;
  performedBy?: string | null;
  account?: AdminAccount | null;
}

export const listAdminTransactions = (
  filters: { search?: string; type?: string; status?: string; from?: string; to?: string; limit?: number } = {},
  signal?: AbortSignal,
): Promise<AdminTransaction[]> => {
  const params = new URLSearchParams();
  if (filters.search) params.set('search', filters.search);
  if (filters.type) params.set('type', filters.type);
  if (filters.status) params.set('status', filters.status);
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  if (filters.limit) params.set('limit', String(filters.limit));
  return apiRequest<AdminTransaction[]>(`/admin/transactions${params.size ? `?${params}` : ''}`, { signal });
};

export const getAdminTransaction = (id: string, signal?: AbortSignal): Promise<AdminTransaction> =>
  apiRequest<AdminTransaction>(`/admin/transactions/${encodeURIComponent(id)}`, { signal });

export const reverseAdminTransaction = (id: string, reason: string): Promise<AdminTransaction> =>
  apiRequest<AdminTransaction>(`/admin/transactions/${encodeURIComponent(id)}/reverse`, {
    method: 'POST',
    body: { reason },
  });

export interface BackupFile {
  name: string;
  size: number;
  createdAt: string | null;
}

export const listBackups = (signal?: AbortSignal): Promise<BackupFile[]> =>
  apiRequest<BackupFile[]>('/admin/backups', { signal });

export const downloadBackup = (name: string): Promise<Blob> =>
  apiDownload(`/admin/backups/${encodeURIComponent(name)}`);

export const generateBackup = (): Promise<{ backups: BackupFile[]; generated: string }> =>
  apiRequest<{ backups: BackupFile[]; generated: string }>('/admin/backups', { method: 'POST' });

export const deleteBackup = (name: string): Promise<{ message: string }> =>
  apiRequest<{ message: string }>(`/admin/backups/${encodeURIComponent(name)}`, {
    method: 'DELETE',
  });

export const deleteDatabase = (): Promise<{ message: string }> =>
  apiRequest<{ message: string }>('/admin/backups/delete-database', {
    method: 'POST',
    body: { confirm: 'DELETE DATABASE' },
  });

export const restoreBackup = (name: string): Promise<{ message: string }> =>
  apiRequest<{ message: string }>('/admin/backups/restore', {
    method: 'POST',
    body: { filename: name, confirm: 'RESTORE' },
  });

/** Restores a .sql dump the admin uploads from their own machine. */
export const restoreBackupFromFile = (file: File): Promise<{ message: string }> => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('confirm', 'RESTORE');
  return apiUpload<{ message: string }>('/admin/backups/restore-upload', formData);
};

export interface BankSettings {
  bankName: string;
  contactEmail: string | null;
  contactPhone: string | null;
  address: string | null;
  logo: string | null;
  maintenanceMode: boolean;
}

export const getAdminSettings = (): Promise<BankSettings> =>
  apiRequest<BankSettings>('/admin/settings');

export const updateAdminSettings = (
  patch: Partial<Omit<BankSettings, 'maintenanceMode'>> & { maintenanceMode?: boolean },
): Promise<BankSettings> =>
  apiRequest<BankSettings>('/admin/settings', { method: 'PATCH', body: patch });

export interface AdminProfile extends AdminUserDetail {
  displayName: string | null;
}

export const getAdminProfile = (): Promise<AdminProfile> =>
  apiRequest<AdminProfile>('/admin/profile');

export const updateAdminProfile = (displayName: string): Promise<AdminProfile> =>
  apiRequest<AdminProfile>('/admin/profile', {
    method: 'PATCH',
    body: { displayName },
  });

export type AuditLogFilters = {
  severity?: AuditSeverity;
  actorId?: string;
  action?: string;
  entityType?: string;
  from?: string;
  to?: string;
};

export const listAuditLogs = (
  filters: AuditLogFilters = {},
  signal?: AbortSignal,
): Promise<AuditLogEntry[]> => {
  const params = new URLSearchParams();
  if (filters.severity) params.set('severity', filters.severity);
  if (filters.actorId) params.set('actorId', filters.actorId);
  if (filters.action) params.set('action', filters.action);
  if (filters.entityType) params.set('entityType', filters.entityType);
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  return apiRequest<AuditLogEntry[]>(`/admin/logs${params.size ? `?${params}` : ''}`, { signal });
};

export interface LoginHistoryEntry {
  id: string;
  action: 'LOGIN_SUCCESS' | 'LOGIN_FAILED' | 'FAILED_LOGIN_SPIKE';
  email: string | null;
  userId: string | null;
  ipAddress: string | null;
  severity: AuditSeverity;
  createdAt: string | null;
}

export const listLoginHistory = (
  email = '',
  signal?: AbortSignal,
): Promise<LoginHistoryEntry[]> =>
  apiRequest<LoginHistoryEntry[]>(
    `/admin/login-history${email ? `?email=${encodeURIComponent(email)}` : ''}`,
    { signal },
  );

export interface SecuritySummary {
  failedLogins24h: number;
  failedLogins1h: number;
  successfulLogins24h: number;
  loginSpikes24h: number;
  warnings24h: number;
  errors24h: number;
}

export const getSecuritySummary = (signal?: AbortSignal): Promise<SecuritySummary> =>
  apiRequest<SecuritySummary>('/admin/security-summary', { signal });
