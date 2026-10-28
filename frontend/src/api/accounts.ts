import { apiRequest } from '@/api/client';

export type AccountType = 'savings' | 'checking';
export type AccountStatus = 'active' | 'frozen' | 'closed';

export interface Account {
  id: string;
  accountNumber: string;
  type: AccountType;
  label: string;
  balance: number;
  currency: string;
  status: AccountStatus;
  isPrimary: boolean;
  interestRate?: number;
  interestEarned?: number;
  overdraftLimit?: number;
  monthlyWithdrawalLimit?: number;
  withdrawalsThisMonth?: number;
  createdAt?: string;
}

export interface CreateAccountInput {
  type: AccountType;
  label?: string;
  currency?: string;
  initialDeposit?: number;
  isPrimary?: boolean;
}

export interface AccountApplicationReceipt {
  id: string;
  accountType: AccountType;
  label: string;
  status: 'pending';
  initialDeposit: number;
}

export interface UpdateAccountInput {
  label?: string;
  isPrimary?: boolean;
}

export const listAccounts = (signal?: AbortSignal): Promise<Account[]> =>
  apiRequest<Account[]>('/accounts', { signal });

export const getAccount = (id: string, signal?: AbortSignal): Promise<Account> =>
  apiRequest<Account>(`/accounts/${id}`, { signal });

export const createAccount = (input: CreateAccountInput): Promise<AccountApplicationReceipt> =>
  apiRequest<AccountApplicationReceipt>('/accounts', { method: 'POST', body: input });

export const updateAccount = (id: string, input: UpdateAccountInput): Promise<Account> =>
  apiRequest<Account>(`/accounts/${id}`, { method: 'PATCH', body: input });

export const closeAccount = (id: string): Promise<void> =>
  apiRequest<void>(`/accounts/${id}`, { method: 'DELETE' });
