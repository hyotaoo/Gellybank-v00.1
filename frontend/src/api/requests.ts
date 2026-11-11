import { apiRequest } from '@/api/client';
import type { Account } from '@/api/accounts';
import type { Transaction } from '@/api/transactions';

export type RequestType = 'deposit' | 'withdrawal' | 'card' | 'card_lost';
export type RequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface TransactionRequest {
  id: string;
  reference: string;
  accountId: string;
  accountNumber: string | null;
  accountLabel: string | null;
  type: RequestType;
  amount: number;
  currency: string;
  note: string | null;
  status: RequestStatus;
  rejectionReason: string | null;
  transactionId: string | null;
  reviewedByRole: 'admin' | 'teller' | 'customer' | null;
  createdAt: string | null;
  reviewedAt: string | null;
}

export interface TellerRequest extends TransactionRequest {
  customerId: string;
  customerName: string;
  customerEmail: string;
  transaction?: Transaction;
  account?: Account;
}

export interface TellerRequestFilters {
  status?: 'pending' | 'approved' | 'rejected' | 'cancelled' | 'all';
  type?: 'deposit' | 'withdrawal' | 'card';
  search?: string;
  from?: string;
  to?: string;
}

export interface CreateRequestInput {
  accountId: string;
  type: 'deposit' | 'withdraw' | 'card' | 'card_lost';
  amount?: number;
  note?: string;
}

export const createRequest = (input: CreateRequestInput, signal?: AbortSignal): Promise<TransactionRequest> =>
  apiRequest<TransactionRequest>('/requests', { method: 'POST', body: input, signal });

export const listMyRequests = (
  status?: RequestStatus,
  signal?: AbortSignal,
): Promise<TransactionRequest[]> => {
  const query = status ? `?status=${status}` : '';
  return apiRequest<TransactionRequest[]>(`/requests${query}`, { signal });
};

export const cancelRequest = (id: string): Promise<void> =>
  apiRequest<void>(`/requests/${encodeURIComponent(id)}`, { method: 'DELETE' });

export const listTellerRequests = (
  filters: TellerRequestFilters = {},
  signal?: AbortSignal,
): Promise<TellerRequest[]> => {
  const query = new URLSearchParams();
  query.set('status', filters.status ?? 'pending');
  if (filters.type) query.set('type', filters.type);
  if (filters.search?.trim()) query.set('search', filters.search.trim());
  if (filters.from) query.set('from', filters.from);
  if (filters.to) query.set('to', filters.to);
  return apiRequest<TellerRequest[]>(`/teller/requests?${query.toString()}`, { signal });
};

export const approveTellerRequest = (id: string): Promise<TellerRequest> =>
  apiRequest<TellerRequest>(`/teller/requests/${encodeURIComponent(id)}/approve`, {
    method: 'POST',
  });

export const rejectTellerRequest = (id: string, reason: string): Promise<TellerRequest> =>
  apiRequest<TellerRequest>(`/teller/requests/${encodeURIComponent(id)}/reject`, {
    method: 'POST',
    body: { reason },
  });
