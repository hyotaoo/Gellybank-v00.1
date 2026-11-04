import { apiRequest, ApiError } from '@/api/client';

export { ApiError };

export interface BankCard {
  id: string;
  accountId: string;
  type: 'debit' | 'credit';
  status: string;
  last4: string | null;
  cardNumber: string | null;
  cvv: string | null;
  expiresOn: string | null;
  issuedAt: string | null;
  holder: string;
  accountNumber: string;
}

export const listCards = (accountId?: string, signal?: AbortSignal): Promise<BankCard[]> => {
  const suffix = accountId ? `?accountId=${encodeURIComponent(accountId)}` : '';
  return apiRequest<BankCard[]>(`/cards${suffix}`, { signal });
};
