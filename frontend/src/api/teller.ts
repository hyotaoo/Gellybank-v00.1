import { apiRequest } from '@/api/client';
import type { Account } from '@/api/accounts';
import type { Transaction } from '@/api/transactions';

export interface TellerCustomer {
  customerId: string;
  name: string;
  email: string;
  phone: string | null;
  status: string;
  accounts: Account[];
}

export interface TellerProfile {
  id: string;
  name: string;
  email: string;
  role: 'teller';
  status: 'active' | 'suspended';
  displayName: string | null;
  emailVerified: boolean;
  lastLoginAt: string | null;
  createdAt: string | null;
}

export interface ProcessTellerTransactionInput {
  accountId: string;
  type: 'deposit' | 'withdraw';
  amount: number;
  note?: string;
}

export interface TellerTransactionSummary {
  count: number;
  total: number;
}

export interface TellerTransactionsResponse {
  currency: string;
  items: Transaction[];
  summary: {
    deposits: TellerTransactionSummary;
    withdrawals: TellerTransactionSummary;
    other: TellerTransactionSummary;
  };
}

export interface TellerTransactionParams {
  from?: string;
  to?: string;
  limit?: number;
}

export const listTellerCustomers = (
  search = '',
  signal?: AbortSignal,
): Promise<TellerCustomer[]> => {
  const query = search.trim() ? `?search=${encodeURIComponent(search.trim())}` : '';
  return apiRequest<TellerCustomer[]>(`/teller/customers${query}`, { signal });
};

export const getTellerAccount = (
  accountId: string,
  signal?: AbortSignal,
): Promise<TellerCustomer> =>
  apiRequest<TellerCustomer>(`/teller/accounts/${encodeURIComponent(accountId)}`, { signal });

export const listTellerAccountTransactions = (
  accountId: string,
  limit = 50,
  signal?: AbortSignal,
): Promise<Transaction[]> =>
  apiRequest<Transaction[]>(
    `/teller/accounts/${encodeURIComponent(accountId)}/transactions?limit=${limit}`,
    { signal },
  );

export const processTellerTransaction = (
  input: ProcessTellerTransactionInput,
): Promise<Transaction> =>
  apiRequest<Transaction>('/teller/transactions', { method: 'POST', body: input });

export const listTellerTransactions = (
  params: TellerTransactionParams = {},
  signal?: AbortSignal,
): Promise<TellerTransactionsResponse> => {
  const query = new URLSearchParams();
  if (params.from) query.set('from', params.from);
  if (params.to) query.set('to', params.to);
  if (params.limit) query.set('limit', String(params.limit));
  const suffix = query.toString();
  return apiRequest<TellerTransactionsResponse>(
    `/teller/transactions${suffix ? `?${suffix}` : ''}`,
    { signal },
  );
};

export const getTellerProfile = (): Promise<TellerProfile> =>
  apiRequest<TellerProfile>('/teller/profile');

export const updateTellerProfile = (displayName: string): Promise<TellerProfile> =>
  apiRequest<TellerProfile>('/teller/profile', {
    method: 'PATCH',
    body: { displayName },
  });
