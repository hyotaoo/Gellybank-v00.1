import { apiRequest } from '@/api/client';

export type TransactionType = 'deposit' | 'withdraw' | 'transfer';
export type TransactionStatus = 'pending' | 'completed' | 'failed' | 'void';

export interface Transaction {
  id: string;
  accountId: string;
  type: TransactionType;
  amount: number;
  currency: string;
  note?: string;
  counterparty?: string;
  reference: string;
  status: TransactionStatus;
  createdAt: string;
}

export interface CreateTransactionInput {
  accountId: string;
  type: Extract<TransactionType, 'deposit' | 'withdraw'>;
  amount: number;
  note?: string;
}

export interface TransferInput {
  sourceAccountId: string;
  amount: number;
  note?: string;
  destinationAccountId?: string;
  beneficiaryId?: string;
}

export interface ListTransactionsParams {
  accountId?: string;
  limit?: number;
}

export const listTransactions = (
  params: ListTransactionsParams = {},
  signal?: AbortSignal,
): Promise<Transaction[]> => {
  const query = new URLSearchParams();
  if (params.accountId) query.set('accountId', params.accountId);
  if (params.limit) query.set('limit', String(params.limit));
  const suffix = query.toString();

  return apiRequest<Transaction[]>(`/transactions${suffix ? `?${suffix}` : ''}`, { signal });
};

export const createTransaction = (input: CreateTransactionInput): Promise<Transaction> =>
  apiRequest<Transaction>('/transactions', { method: 'POST', body: input });

export const createTransfer = (input: TransferInput): Promise<Transaction> =>
  apiRequest<Transaction>('/transactions/transfer', { method: 'POST', body: input });

export const updateTransactionNote = (id: string, note: string): Promise<Transaction> =>
  apiRequest<Transaction>(`/transactions/${id}`, { method: 'PATCH', body: { note } });

export const voidTransaction = (id: string): Promise<void> =>
  apiRequest<void>(`/transactions/${id}`, { method: 'DELETE' });
