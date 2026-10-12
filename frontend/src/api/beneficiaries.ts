import { apiRequest } from '@/api/client';

export interface Beneficiary {
  id: string;
  name: string;
  accountNumber: string;
  bank?: string;
}

export interface CreateBeneficiaryInput {
  name: string;
  accountNumber: string;
  bank?: string;
}

export const listBeneficiaries = (signal?: AbortSignal): Promise<Beneficiary[]> =>
  apiRequest<Beneficiary[]>('/beneficiaries', { signal });

export const createBeneficiary = (input: CreateBeneficiaryInput): Promise<Beneficiary> =>
  apiRequest<Beneficiary>('/beneficiaries', { method: 'POST', body: input });

export const updateBeneficiary = (
  id: string,
  input: Partial<CreateBeneficiaryInput>,
): Promise<Beneficiary> =>
  apiRequest<Beneficiary>(`/beneficiaries/${id}`, { method: 'PATCH', body: input });

export const deleteBeneficiary = (id: string): Promise<void> =>
  apiRequest<void>(`/beneficiaries/${id}`, { method: 'DELETE' });
