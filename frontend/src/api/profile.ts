import { apiRequest } from '@/api/client';

export interface Profile {
  customerId: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  email: string;
  phone: string | null;
  address: string | null;
}

export const getProfile = (signal?: AbortSignal): Promise<Profile> =>
  apiRequest<Profile>('/profile', { signal });
