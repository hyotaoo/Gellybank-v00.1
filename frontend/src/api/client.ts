const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api';

const AUTH_TOKEN_KEY = 'gellybank.token';

export const getAuthToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(AUTH_TOKEN_KEY);
};

export const setAuthToken = (token: string | null): void => {
  if (typeof window === 'undefined') return;
  if (token) {
    window.localStorage.setItem(AUTH_TOKEN_KEY, token);
  } else {
    window.localStorage.removeItem(AUTH_TOKEN_KEY);
  }
};

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

interface RequestOptions {
  method?: HttpMethod;
  body?: unknown;
  signal?: AbortSignal;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, signal } = options;

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const token = getAuthToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    let message = `Request failed (status ${response.status}).`;
    let code: string | undefined;

    try {
      const data: unknown = await response.json();
      if (data && typeof data === 'object') {
        const record = data as { message?: unknown; code?: unknown };
        if (typeof record.message === 'string') message = record.message;
        if (typeof record.code === 'string') code = record.code;
      }
    } catch {
      // response had no JSON body — keep the default message
    }

    throw new ApiError(message, response.status, code);
  }

  if (response.status === 204) return undefined as T;

  return (await response.json()) as T;
}
