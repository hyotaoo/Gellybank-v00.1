import { apiRequest } from '@/api/client';

export interface RegisterInput {
  firstName: string;
  middleName?: string;
  lastName: string;
  suffix?: string;
  birthdate: string;
  email: string;
  countryCode: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  mailingSame: string;
  citizenship: string;
  employmentStatus: string;
  occupation: string;
  employer?: string;
  annualIncome: string;
  sourceOfFunds: string;
  accountType: 'savings' | 'checking';
  ownershipType: string;
  purposeOfAccount: string;
  password: string;
  agreeTerms: boolean;
  agreePrivacy: boolean;
  agreeInsights: boolean;
}

export interface AuthUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: 'customer' | 'teller' | 'admin';
}

const AUTH_USER_KEY = 'gellybank.user';

export const getAuthUser = (): AuthUser | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(AUTH_USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
};

export const setAuthUser = (user: AuthUser | null): void => {
  if (typeof window === 'undefined') return;
  if (user) {
    window.localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
  } else {
    window.localStorage.removeItem(AUTH_USER_KEY);
  }
};

export interface AuthResponse {
  user: AuthUser;
  token: string;
  application?: {
    id: string;
    status: 'pending' | 'approved' | 'rejected';
    accountType?: string;
    createdAt?: string;
  };
}

export interface LoginInput {
  email: string;
  password: string;
}

export const register = (input: RegisterInput): Promise<AuthResponse> =>
  apiRequest<AuthResponse>('/auth/register', { method: 'POST', body: input });

export const login = (input: LoginInput): Promise<AuthResponse> =>
  apiRequest<AuthResponse>('/auth/login', { method: 'POST', body: input });
