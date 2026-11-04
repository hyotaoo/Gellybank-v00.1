import { apiRequest } from '@/api/client';

export interface Profile {
  customerId: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  email: string;
  phone: string | null;
  address: string | null;
  avatar: string | null;
  emailVerified: boolean;
  customerStatus: string;
}

export interface ProfileUpdate {
  firstName?: string;
  middleName?: string;
  lastName?: string;
  phone?: string;
  address?: string;
  avatar?: string | null;
}

export const getProfile = (signal?: AbortSignal): Promise<Profile> =>
  apiRequest<Profile>('/profile', { signal });

export const updateProfile = (input: ProfileUpdate): Promise<Profile> =>
  apiRequest<Profile>('/profile', { method: 'PATCH', body: input });
