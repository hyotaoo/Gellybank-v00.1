import { apiRequest, ApiError } from '@/api/client';

export { ApiError };

export interface NewCardRequest {
  accountId?: string;
  cardType?: 'debit' | 'credit';
  currency?: string;
}

export interface BankCard {
  id: string;
  type: 'debit' | 'credit';
  last4: string;
  status: string;
}

export const requestNewCard = (
  payload: NewCardRequest = {},
  signal?: AbortSignal,
): Promise<BankCard> =>
  apiRequest<BankCard>('/cards/request', { method: 'POST', body: payload, signal });
