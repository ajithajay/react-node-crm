import { getAccessToken } from './auth-session.js';
import { getApiBaseUrl } from './host.js';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set('Content-Type', 'application/json');
  const token = getAccessToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(`${getApiBaseUrl()}${path}`, { ...init, headers, credentials: 'include' });
  const data = res.status === 204 ? null : await res.json().catch(() => null);

  if (!res.ok) throw new ApiError(res.status, (data as { error?: string } | null)?.error ?? res.statusText);
  return data as T;
}

const get = <T>(path: string): Promise<T> => apiFetch<T>(path, { method: 'GET' });
const post = <T>(path: string, body?: unknown): Promise<T> =>
  apiFetch<T>(path, { method: 'POST', body: body !== undefined ? JSON.stringify(body) : undefined });

export interface WorkspaceSummary {
  id: string;
  name: string;
  subdomain: string;
}

export type LoginResult =
  | { requiresTwoFactor: true; challengeToken: string }
  | { requiresTwoFactor: false; loginToken: string; redirectUrl: string };

export type AgnosticLoginResult = { workspaces: WorkspaceSummary[] } & (
  | LoginResult
  | { requiresTwoFactor: false; workspaceAgnosticToken: string }
);

export interface SubdomainAvailability {
  available: boolean;
  reason?: 'invalid_format' | 'reserved' | 'taken';
  suggestions?: string[];
}

export const authApi = {
  signup: (email: string, password: string) => post<{ userId: string }>('/auth/signup', { email, password }),

  verifyEmail: (token: string) => post<{ workspaceAgnosticToken: string }>('/auth/verify-email', { token }),

  requestPasswordReset: (email: string) => post<{ ok: true }>('/auth/password-reset/request', { email }),

  validatePasswordResetToken: (token: string) =>
    post<{ valid: boolean }>('/auth/password-reset/validate', { token }),

  confirmPasswordReset: (token: string, password: string) =>
    post<{ ok: true }>('/auth/password-reset/confirm', { token, password }),

  subdomainAvailability: (subdomain: string) =>
    get<SubdomainAvailability>(`/auth/subdomain-availability?subdomain=${encodeURIComponent(subdomain)}`),

  createWorkspace: (token: string, name: string, subdomain: string) =>
    post<{ loginToken: string; redirectUrl: string }>('/auth/workspaces', { token, name, subdomain }),

  loginScoped: (email: string, password: string) => post<LoginResult>('/auth/login', { email, password }),

  loginAgnostic: (email: string, password: string) =>
    post<AgnosticLoginResult>('/auth/login/agnostic', { email, password }),

  selectWorkspace: (token: string, workspaceId: string) =>
    post<LoginResult>('/auth/login/select-workspace', { token, workspaceId }),

  exchangeLoginToken: (token: string) =>
    post<{ accessToken: string; refreshToken: string; workspaceId: string }>('/auth/login/exchange', { token }),

  verifyLoginTwoFactor: (challengeToken: string, code: string) =>
    post<{ loginToken: string; redirectUrl: string }>('/auth/login/2fa/verify', { challengeToken, code }),

  refresh: () =>
    post<{ accessToken?: string; workspaceId?: string; refreshToken: string; workspaceAgnosticToken?: string }>(
      '/auth/refresh',
    ),

  logout: () => post<{ ok: true }>('/auth/logout'),
};

export interface Me {
  id: string;
  email: string;
  isEmailVerified: boolean;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  roleId: string | null;
  colorScheme: string;
}

export interface CurrentWorkspace {
  id: string;
  name: string;
  subdomain: string;
  logoUrl: string | null;
}

export interface Member {
  id: string;
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  roleId: string | null;
}

export const meApi = {
  get: () => get<Me>('/users/me'),
};

export const workspaceApi = {
  getCurrent: () => get<CurrentWorkspace>('/workspace'),
};

export const memberApi = {
  list: () => get<Member[]>('/members'),
};
