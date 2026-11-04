import { apiRequest } from '@/api/client';

export interface RegisterInput {
  firstName: string;
  middleName?: string;
  lastName: string;
  birthdate: string;
  email: string;
  countryCode: string;
  phone: string;
  address: string;
  sourceOfFunds: string;
  accountType: 'savings' | 'checking';
  purposeOfAccount: string;
  password: string;
  acceptTerms: boolean;
  acceptPrivacy: boolean;
  acceptAiInsights: boolean;
}

export interface AuthUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: 'customer' | 'teller' | 'admin';
}

export interface AuthResponse {
  user: AuthUser;
  token: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterResponse {
  email: string;
  message: string;
}

export const register = (input: RegisterInput): Promise<RegisterResponse> =>
  apiRequest<RegisterResponse>('/auth/register', { method: 'POST', body: input });

export const verifyEmail = (email: string, code: string): Promise<AuthResponse> =>
  apiRequest<AuthResponse>('/auth/verify-email', { method: 'POST', body: { email, code } });

export const resendVerification = (email: string): Promise<{ message: string }> =>
  apiRequest<{ message: string }>('/auth/resend-verification', { method: 'POST', body: { email } });

export const login = (input: LoginInput): Promise<AuthResponse> =>
  apiRequest<AuthResponse>('/auth/login', { method: 'POST', body: input });

export const resetPassword = (token: string, password: string): Promise<{ message: string }> =>
  apiRequest<{ message: string }>('/auth/reset-password', {
    method: 'POST',
    body: { token, password },
  });
