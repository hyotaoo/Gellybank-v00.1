import { apiRequest } from '@/api/client';

export type RequestType = 'deposit' | 'withdrawal';
export type RequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface TransactionRequest {
  id: string;
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
}

export interface CreateRequestInput {
  accountId: string;
  type: 'deposit' | 'withdraw';
  amount: number;
  note?: string;
}

export const createRequest = (input: CreateRequestInput): Promise<TransactionRequest> =>
  apiRequest<TransactionRequest>('/requests', { method: 'POST', body: input });

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
  status: 'pending' | 'approved' | 'rejected' | 'cancelled' | 'all' = 'pending',
  signal?: AbortSignal,
): Promise<TellerRequest[]> =>
  apiRequest<TellerRequest[]>(`/teller/requests?status=${status}`, { signal });

export const approveTellerRequest = (id: string): Promise<TellerRequest> =>
  apiRequest<TellerRequest>(`/teller/requests/${encodeURIComponent(id)}/approve`, {
    method: 'POST',
  });

export const rejectTellerRequest = (id: string, reason: string): Promise<TellerRequest> =>
  apiRequest<TellerRequest>(`/teller/requests/${encodeURIComponent(id)}/reject`, {
    method: 'POST',
    body: { reason },
  });
