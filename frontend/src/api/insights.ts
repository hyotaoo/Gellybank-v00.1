import { apiRequest } from '@/api/client';

export interface SpendingCategory {
  label: string;
  value: number;
  amount?: number;
  color?: string;
}

export interface SpendingInsights {
  total: number;
  currency: string;
  categories: SpendingCategory[];
  tips?: string[];
}

export const getSpendingInsights = (
  accountId?: string,
  signal?: AbortSignal,
): Promise<SpendingInsights> => {
  const suffix = accountId ? `?accountId=${encodeURIComponent(accountId)}` : '';
  return apiRequest<SpendingInsights>(`/insights/spending${suffix}`, { signal });
};
