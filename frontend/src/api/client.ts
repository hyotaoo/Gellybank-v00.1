const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api';

export type TokenScope = 'customer' | 'admin' | 'teller';

const authTokenKey = (scope: TokenScope): string => `gellybank.${scope}.token`;

const tokenScopeForPath = (path: string): TokenScope => {
  if (path.startsWith('/admin')) return 'admin';
  if (path.startsWith('/teller')) return 'teller';
  return 'customer';
};

export const getAuthToken = (scope: TokenScope = 'customer'): string | null => {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(authTokenKey(scope));
};

export const setAuthToken = (token: string | null, scope: TokenScope = 'customer'): void => {
  if (typeof window === 'undefined') return;
  if (token) {
    window.localStorage.setItem(authTokenKey(scope), token);
  } else {
    window.localStorage.removeItem(authTokenKey(scope));
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
  /** Overrides the token scope derived from the path. */
  authScope?: TokenScope;
}

const errorFromResponse = async (response: Response): Promise<ApiError> => {
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

  return new ApiError(message, response.status, code);
};

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, signal, authScope } = options;

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const token = getAuthToken(authScope ?? tokenScopeForPath(path));
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  });

  if (!response.ok) throw await errorFromResponse(response);

  if (response.status === 204) return undefined as T;

  return (await response.json()) as T;
}

export async function apiDownload(path: string): Promise<Blob> {
  const headers: Record<string, string> = {};
  const token = getAuthToken(tokenScopeForPath(path));
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_BASE_URL}${path}`, { headers });

  if (!response.ok) throw await errorFromResponse(response);

  return response.blob();
}
