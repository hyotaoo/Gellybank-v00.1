import { apiRequest } from '@/api/client';

export interface PublicBankSettings {
  bankName: string;
  contactEmail: string | null;
  contactPhone: string | null;
  address: string | null;
  logo: string | null;
  maintenanceMode: boolean;
}

export const getPublicSettings = (): Promise<PublicBankSettings> =>
  apiRequest<PublicBankSettings>('/settings');
