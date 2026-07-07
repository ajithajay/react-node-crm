import type {
  UpdatePreferencesRequest,
  UpdateWorkspaceRequest,
  AuditLogQuery,
  CreateInvitationRequest,
  CreateRoleRequest,
  UpdateRoleRequest,
  UpdateObjectPermissionRequest,
  UpdateFieldPermissionRequest,
  CreateObjectRequest,
  UpdateObjectRequest,
  CreateFieldRequest,
  UpdateFieldRequest,
  CreateRelationRequest,
  CreateMorphRelationRequest,
  CreateIndexRequest,
  SetObjectIdentifiersRequest,
  CreateApiKeyRequest,
  CreateWebhookRequest,
  UpdateWebhookRequest,
} from '@saasly/shared';
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
const patch = <T>(path: string, body?: unknown): Promise<T> =>
  apiFetch<T>(path, { method: 'PATCH', body: body !== undefined ? JSON.stringify(body) : undefined });
const del = <T>(path: string, body?: unknown): Promise<T> =>
  apiFetch<T>(path, { method: 'DELETE', body: body !== undefined ? JSON.stringify(body) : undefined });
const put = <T>(path: string, body?: unknown): Promise<T> =>
  apiFetch<T>(path, { method: 'PUT', body: body !== undefined ? JSON.stringify(body) : undefined });

/** Fetch without a Content-Type header — the browser sets the multipart boundary itself. */
async function postForm<T>(path: string, form: FormData): Promise<T> {
  const headers = new Headers();
  const token = getAccessToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(`${getApiBaseUrl()}${path}`, {
    method: 'POST',
    body: form,
    headers,
    credentials: 'include',
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, (data as { error?: string } | null)?.error ?? res.statusText);
  return data as T;
}

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
  colorScheme: UpdatePreferencesRequest['colorScheme'];
  timeZone: string;
  dateFormat: UpdatePreferencesRequest['dateFormat'];
  timeFormat: UpdatePreferencesRequest['timeFormat'];
  numberFormat: UpdatePreferencesRequest['numberFormat'];
  twoFactorEnabled: boolean;
}

/** File URLs are stored host-relative (`/files/:id`) — resolve against the current API host. */
export function resolveFileUrl(url: string | null): string | null {
  if (!url) return null;
  return `${getApiBaseUrl()}${url}`;
}

export interface CurrentWorkspace {
  id: string;
  name: string;
  subdomain: string;
  logoUrl: string | null;
  defaultRoleId: string | null;
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

  update: (firstName: string, lastName: string) => patch<{ ok: true }>('/users/me', { firstName, lastName }),

  updatePreferences: (input: UpdatePreferencesRequest) =>
    patch<{ ok: true }>('/users/me/preferences', input),

  uploadAvatar: (file: File) => {
    const form = new FormData();
    form.set('file', file);
    return postForm<{ id: string; url: string }>('/users/me/avatar', form);
  },

  removeAvatar: () => del<{ ok: true }>('/users/me/avatar'),

  changePassword: (currentPassword: string, newPassword: string) =>
    post<{ ok: true }>('/users/me/password', { currentPassword, newPassword }),

  deleteAccount: (password: string) => del<{ ok: true }>('/users/me', { password }),
};

export const twoFactorApi = {
  enroll: () => post<{ otpauthUrl: string; secret: string; qrCodeDataUrl: string }>('/auth/2fa/enroll'),

  verifyEnroll: (code: string) => post<{ ok: true }>('/auth/2fa/enroll/verify', { code }),

  deactivate: () => post<{ ok: true }>('/auth/2fa/deactivate'),
};

export const workspaceApi = {
  getCurrent: () => get<CurrentWorkspace>('/workspace'),

  update: (input: UpdateWorkspaceRequest) => patch<CurrentWorkspace>('/workspace', input),

  uploadLogo: (file: File) => {
    const form = new FormData();
    form.set('file', file);
    return postForm<{ logoUrl: string }>('/workspace/logo', form);
  },

  removeLogo: () => del<{ ok: true }>('/workspace/logo'),

  setDefaultRole: (roleId: string) => patch<{ ok: true }>('/workspace/default-role', { roleId }),
};

export const memberApi = {
  list: () => get<Member[]>('/members'),

  updateRole: (memberId: string, roleId: string) => patch<{ ok: true }>(`/members/${memberId}/role`, { roleId }),
};

export interface Role {
  id: string;
  name: string;
  label: string;
  icon: string;
  isEditable: boolean;
}

export interface RoleDetail extends Role {
  description: string | null;
  canUpdateAllSettings: boolean;
  canReadAllObjectRecords: boolean;
  canUpdateAllObjectRecords: boolean;
  canSoftDeleteAllObjectRecords: boolean;
  canDestroyAllObjectRecords: boolean;
  canAccessAllTools: boolean;
  memberCount: number;
}

export interface ObjectPermission {
  objectMetadataId: string;
  objectLabel: string;
  icon: string;
  isCustom: boolean;
  hasOverride: boolean;
  canRead: boolean | null;
  canUpdate: boolean | null;
  canSoftDelete: boolean | null;
  canDestroy: boolean | null;
}

export interface FieldPermission {
  fieldMetadataId: string;
  fieldLabel: string;
  fieldType: string;
  icon: string;
  isRestrictable: boolean;
  canRead: boolean | null;
  canUpdate: boolean | null;
}

export interface RoleMember {
  id: string;
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
}

export const roleApi = {
  list: () => get<Role[]>('/roles'),

  get: (id: string) => get<RoleDetail>(`/roles/${id}`),

  create: (input: CreateRoleRequest) => post<RoleDetail>('/roles', input),

  update: (id: string, input: UpdateRoleRequest) => patch<RoleDetail>(`/roles/${id}`, input),

  remove: (id: string) => del<{ ok: true }>(`/roles/${id}`),

  getSettingsPermissions: (id: string) => get<string[]>(`/roles/${id}/settings-permissions`),

  updateSettingsPermissions: (id: string, flags: string[]) =>
    put<{ ok: true }>(`/roles/${id}/settings-permissions`, { flags }),

  listObjectPermissions: (id: string) => get<ObjectPermission[]>(`/roles/${id}/object-permissions`),

  updateObjectPermission: (id: string, objectMetadataId: string, input: UpdateObjectPermissionRequest) =>
    put<{ ok: true }>(`/roles/${id}/object-permissions/${objectMetadataId}`, input),

  removeObjectPermission: (id: string, objectMetadataId: string) =>
    del<{ ok: true }>(`/roles/${id}/object-permissions/${objectMetadataId}`),

  listFieldPermissions: (id: string, objectMetadataId: string) =>
    get<FieldPermission[]>(`/roles/${id}/objects/${objectMetadataId}/field-permissions`),

  updateFieldPermission: (id: string, fieldMetadataId: string, input: UpdateFieldPermissionRequest) =>
    put<{ ok: true }>(`/roles/${id}/field-permissions/${fieldMetadataId}`, input),

  listMembers: (id: string) => get<RoleMember[]>(`/roles/${id}/members`),
};

export interface AuditLogEntry {
  id: string;
  action: string;
  actorEmail: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface AuditLogPage {
  entries: AuditLogEntry[];
  page: number;
  pageSize: number;
  total: number;
}

export const auditLogApi = {
  list: (query: Partial<AuditLogQuery> = {}) => {
    const params = new URLSearchParams();
    if (query.action) params.set('action', query.action);
    if (query.page) params.set('page', String(query.page));
    if (query.pageSize) params.set('pageSize', String(query.pageSize));
    const qs = params.toString();
    return get<AuditLogPage>(`/audit-logs${qs ? `?${qs}` : ''}`);
  },
};

export interface Invitation {
  id: string;
  email: string;
  status: 'PENDING' | 'ACCEPTED' | 'REVOKED';
  roleId: string | null;
  createdAt: string;
  expiresAt: string;
}

export const invitationApi = {
  list: () => get<Invitation[]>('/members/invitations'),

  create: (input: CreateInvitationRequest) => post<Invitation>('/members/invitations', input),

  resend: (id: string) => post<{ ok: true }>(`/members/invitations/${id}/resend`),

  revoke: (id: string) => del<{ ok: true }>(`/members/invitations/${id}`),
};

export interface InvitationPreview {
  email: string;
  workspaceName: string;
  workspaceSubdomain: string;
  hasAccount: boolean;
}

export const publicInvitationApi = {
  preview: (token: string) => get<InvitationPreview>(`/invitations/${encodeURIComponent(token)}`),

  accept: (token: string, password: string) =>
    post<{ loginToken: string; redirectUrl: string }>(`/invitations/${encodeURIComponent(token)}/accept`, {
      password,
    }),
};

export interface DataModelObject {
  id: string;
  nameSingular: string;
  namePlural: string;
  labelSingular: string;
  labelPlural: string;
  icon: string;
  description: string | null;
  isCustom: boolean;
  isSystem: boolean;
  isActive: boolean;
  labelIdentifierFieldMetadataId: string | null;
  imageIdentifierFieldMetadataId: string | null;
  fieldCount: number;
}

export interface DataModelField {
  id: string;
  name: string;
  label: string;
  type: string;
  icon: string;
  description: string | null;
  isCustom: boolean;
  isSystem: boolean;
  isActive: boolean;
  isNullable: boolean;
  isUnique: boolean;
  isRestrictable: boolean;
  settings: Record<string, unknown> | null;
  defaultValue: unknown;
}

export interface DataModelIndex {
  id: string;
  name: string;
  isUnique: boolean;
  columnNames: string[];
}

export interface DataModelObjectDetail {
  object: DataModelObject;
  fields: DataModelField[];
  indexes: DataModelIndex[];
}

export const dataModelApi = {
  listObjects: () => get<DataModelObject[]>('/data-model/objects'),

  getObject: (id: string) => get<DataModelObjectDetail>(`/data-model/objects/${id}`),

  createObject: (input: CreateObjectRequest) => post<DataModelObject>('/data-model/objects', input),

  updateObject: (id: string, input: UpdateObjectRequest) => patch<DataModelObject>(`/data-model/objects/${id}`, input),

  setObjectActive: (id: string, isActive: boolean) =>
    patch<{ ok: true }>(`/data-model/objects/${id}/active`, { isActive }),

  setObjectIdentifiers: (id: string, input: SetObjectIdentifiersRequest) =>
    patch<DataModelObject>(`/data-model/objects/${id}/identifiers`, input),

  deleteObject: (id: string) => del<{ ok: true }>(`/data-model/objects/${id}`),

  createField: (objectId: string, input: CreateFieldRequest) =>
    post<DataModelField>(`/data-model/objects/${objectId}/fields`, input),

  updateField: (objectId: string, fieldId: string, input: UpdateFieldRequest) =>
    patch<DataModelField>(`/data-model/objects/${objectId}/fields/${fieldId}`, input),

  setFieldActive: (objectId: string, fieldId: string, isActive: boolean) =>
    patch<{ ok: true }>(`/data-model/objects/${objectId}/fields/${fieldId}/active`, { isActive }),

  deleteField: (objectId: string, fieldId: string) => del<{ ok: true }>(`/data-model/objects/${objectId}/fields/${fieldId}`),

  createRelation: (objectId: string, input: CreateRelationRequest) =>
    post<{ forward: DataModelField; reverse: DataModelField }>(`/data-model/objects/${objectId}/relations`, input),

  createMorphRelation: (objectId: string, input: CreateMorphRelationRequest) =>
    post<{ forward: DataModelField; reverses: DataModelField[] }>(`/data-model/objects/${objectId}/morph-relations`, input),

  createIndex: (objectId: string, input: CreateIndexRequest) =>
    post<DataModelIndex>(`/data-model/objects/${objectId}/indexes`, input),

  deleteIndex: (objectId: string, indexId: string) =>
    del<{ ok: true }>(`/data-model/objects/${objectId}/indexes/${indexId}`),
};

export interface ApiKey {
  id: string;
  name: string;
  roleId: string | null;
  isRevoked: boolean;
  isExpired: boolean;
  expiresAt: string | null;
  createdAt: string;
}

export const apiKeyApi = {
  list: () => get<ApiKey[]>('/api-keys'),

  create: (input: CreateApiKeyRequest) => post<{ apiKey: ApiKey; token: string }>('/api-keys', input),

  revoke: (id: string) => del<{ ok: true }>(`/api-keys/${id}`),
};

export interface Webhook {
  id: string;
  targetUrl: string;
  operations: string[];
  secret: string | null;
  description: string | null;
  createdAt: string;
}

export const webhookApi = {
  list: () => get<Webhook[]>('/webhooks'),

  create: (input: CreateWebhookRequest) => post<Webhook>('/webhooks', input),

  update: (id: string, input: UpdateWebhookRequest) => patch<Webhook>(`/webhooks/${id}`, input),

  regenerateSecret: (id: string) => post<Webhook>(`/webhooks/${id}/regenerate-secret`),

  remove: (id: string) => del<{ ok: true }>(`/webhooks/${id}`),
};

export const openApiApi = {
  getSpec: (schema: 'core' | 'metadata') => get<Record<string, unknown>>(`/open-api/${schema}`),
};
