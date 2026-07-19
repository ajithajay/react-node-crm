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
  PageLayoutDto,
  SavePageLayoutRequest,
  DashboardSummary,
  DashboardDetail,
  SaveDashboardLayoutRequest,
  ChartDataRequest,
  ChartDataResponse,
  WorkflowSummary,
  WorkflowDetail,
  WorkflowVersionDetail,
  WorkflowVersionSummary,
  WorkflowRunSummary,
  WorkflowRunDetail,
  WorkflowRunnableSummary,
  ManualTriggerAvailability,
  UpdateWorkflowVersionRequest,
  MergeRecordsRequest,
} from '@saasly/shared';
export type {
  PageLayoutDto as PageLayout,
  PageLayoutTabDto as PageLayoutTab,
  PageLayoutWidgetDto as PageLayoutWidget,
  PageLayoutGroupDto as PageLayoutGroup,
  PageLayoutFieldDto as PageLayoutField,
  PageLayoutWidgetType,
  DashboardSummary as Dashboard,
  DashboardDetail,
  DashboardTabDto as DashboardTab,
  DashboardWidgetDto as DashboardWidget,
  DashboardWidgetType,
  DashboardWidgetConfiguration,
  GridPosition,
  GraphType,
  AggregateOperation,
  DateGranularity,
  ChartNumberFormat,
  ChartDataPoint,
  BarChartLayout,
  ChartOrderBy,
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

/** GET a file response (e.g. CSV export) as a Blob + its server-suggested filename. */
async function getFile(path: string): Promise<{ blob: Blob; filename: string }> {
  const headers = new Headers();
  const token = getAccessToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(`${getApiBaseUrl()}${path}`, { headers, credentials: 'include' });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new ApiError(res.status, (data as { error?: string } | null)?.error ?? res.statusText);
  }
  const disposition = res.headers.get('Content-Disposition') ?? '';
  const filename = /filename="([^"]+)"/.exec(disposition)?.[1] ?? 'export.csv';
  return { blob: await res.blob(), filename };
}

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
  customDomain: string | null;
  logoUrl: string | null;
  defaultRoleId: string | null;
  editableProfileFields: string[];
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

  remove: () => del<{ ok: true }>('/workspace'),
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

/**
 * One condition of a row-level permission rule: `<field> <operand> <value>`, where
 * `valueMode: 'CURRENT_USER'` ignores `value` and resolves against the caller's workspace member
 * at query time instead (e.g. "Owner is current user"). `logicalOperator` joins this condition
 * with the *previous* one in the list (ignored on the first condition) — flat AND/OR, no nesting.
 */
export interface RowLevelPermissionCondition {
  fieldMetadataId: string;
  fieldLabel?: string;
  operand: string;
  valueMode: 'LITERAL' | 'CURRENT_USER';
  value?: unknown;
  logicalOperator: 'AND' | 'OR';
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

  listRowLevelPermissions: (id: string, objectMetadataId: string) =>
    get<RowLevelPermissionCondition[]>(`/roles/${id}/objects/${objectMetadataId}/row-level-permissions`),

  replaceRowLevelPermissions: (id: string, objectMetadataId: string, conditions: RowLevelPermissionCondition[]) =>
    put<{ ok: true }>(`/roles/${id}/objects/${objectMetadataId}/row-level-permissions`, { conditions }),

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
    if (query.actorUserId) params.set('actorUserId', query.actorUserId);
    if (query.from) params.set('from', query.from);
    if (query.to) params.set('to', query.to);
    if (query.search) params.set('search', query.search);
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
  isVisibleInRecordPage: boolean;
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

  setFieldRecordPageVisibility: (objectId: string, fieldId: string, isVisible: boolean) =>
    patch<DataModelField>(`/data-model/objects/${objectId}/fields/${fieldId}/record-page-visibility`, { isVisible }),

  deleteField: (objectId: string, fieldId: string) => del<{ ok: true }>(`/data-model/objects/${objectId}/fields/${fieldId}`),

  createRelation: (objectId: string, input: CreateRelationRequest) =>
    post<{ forward: DataModelField; reverse: DataModelField }>(`/data-model/objects/${objectId}/relations`, input),

  createMorphRelation: (objectId: string, input: CreateMorphRelationRequest) =>
    post<{ forward: DataModelField; reverses: DataModelField[] }>(`/data-model/objects/${objectId}/morph-relations`, input),

  createIndex: (objectId: string, input: CreateIndexRequest) =>
    post<DataModelIndex>(`/data-model/objects/${objectId}/indexes`, input),

  deleteIndex: (objectId: string, indexId: string) =>
    del<{ ok: true }>(`/data-model/objects/${objectId}/indexes/${indexId}`),

  getSections: (objectId: string) => get<PageSection[]>(`/data-model/objects/${objectId}/sections`),

  setSections: (objectId: string, sections: { label: string; fieldMetadataIds: string[] }[]) =>
    put<PageSection[]>(`/data-model/objects/${objectId}/sections`, sections),

  getPageLayout: (objectId: string) => get<PageLayoutDto>(`/data-model/objects/${objectId}/page-layout`),

  savePageLayout: (objectId: string, input: SavePageLayoutRequest) =>
    put<PageLayoutDto>(`/data-model/objects/${objectId}/page-layout`, input),

  resetPageLayout: (objectId: string) => post<PageLayoutDto>(`/data-model/objects/${objectId}/page-layout/reset`, {}),

  resetPageLayoutWidget: (objectId: string, widgetId: string) =>
    post<PageLayoutDto>(`/data-model/objects/${objectId}/page-layout/widgets/${widgetId}/reset`, {}),
};

export interface PageSection {
  id: string;
  label: string;
  position: number;
  fieldMetadataIds: string[];
}

export interface NavigationMenuItem {
  id: string;
  type: 'FOLDER' | 'OBJECT' | 'VIEW' | 'LINK';
  label: string;
  icon: string | null;
  color: string | null;
  position: number;
  folderId: string | null;
  targetObjectMetadataId: string | null;
  viewId: string | null;
  link: string | null;
}

export const navigationApi = {
  list: () => get<NavigationMenuItem[]>('/navigation'),
  create: (input: {
    type: 'FOLDER' | 'OBJECT' | 'VIEW' | 'LINK';
    label: string;
    icon?: string | null;
    color?: string | null;
    folderId?: string | null;
    targetObjectMetadataId?: string | null;
    viewId?: string | null;
    link?: string | null;
  }) => post<NavigationMenuItem>('/navigation', input),
  update: (
    id: string,
    input: { label?: string; icon?: string | null; color?: string | null; folderId?: string | null; position?: number },
  ) => patch<NavigationMenuItem>(`/navigation/${id}`, input),
  remove: (id: string) => del<{ ok: true }>(`/navigation/${id}`),
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

// ---- Generic record CRUD (Phase 6) ----

export interface RecordListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  sortField?: string;
  sortDirection?: 'ASC' | 'DESC';
  filter?: { field: string; operand: string; value?: unknown }[];
}

export interface RecordListResult {
  records: Record<string, unknown>[];
  page: number;
  pageSize: number;
  total: number;
}

export const recordApi = {
  list: (objectNamePlural: string, params: RecordListParams = {}) => {
    const q = new URLSearchParams();
    if (params.page) q.set('page', String(params.page));
    if (params.pageSize) q.set('pageSize', String(params.pageSize));
    if (params.search) q.set('search', params.search);
    if (params.sortField) q.set('sortField', params.sortField);
    if (params.sortDirection) q.set('sortDirection', params.sortDirection);
    if (params.filter && params.filter.length > 0) q.set('filter', JSON.stringify(params.filter));
    const qs = q.toString();
    return get<RecordListResult>(`/rest/${objectNamePlural}${qs ? `?${qs}` : ''}`);
  },

  get: (objectNamePlural: string, id: string) => get<Record<string, unknown>>(`/rest/${objectNamePlural}/${id}`),

  create: (objectNamePlural: string, body: Record<string, unknown>) =>
    post<Record<string, unknown>>(`/rest/${objectNamePlural}`, body),

  update: (objectNamePlural: string, id: string, body: Record<string, unknown>) =>
    patch<Record<string, unknown>>(`/rest/${objectNamePlural}/${id}`, body),

  remove: (objectNamePlural: string, id: string, hard = false) =>
    del<{ ok: true }>(`/rest/${objectNamePlural}/${id}${hard ? '?hard=true' : ''}`),

  exportCsv: (objectNamePlural: string, params: RecordListParams = {}) => {
    const q = new URLSearchParams();
    if (params.search) q.set('search', params.search);
    if (params.sortField) q.set('sortField', params.sortField);
    if (params.sortDirection) q.set('sortDirection', params.sortDirection);
    if (params.filter && params.filter.length > 0) q.set('filter', JSON.stringify(params.filter));
    const qs = q.toString();
    return getFile(`/rest/${objectNamePlural}/export${qs ? `?${qs}` : ''}`);
  },

  importCsv: (objectNamePlural: string, file: File) => {
    const form = new FormData();
    form.set('file', file);
    return postForm<ImportSummary>(`/rest/${objectNamePlural}/import`, form);
  },

  duplicates: (objectNamePlural: string, id: string) =>
    get<DuplicateMatch[]>(`/rest/${objectNamePlural}/${id}/duplicates`),

  merge: (objectNamePlural: string, input: MergeRecordsRequest) =>
    post<Record<string, unknown>>(`/rest/${objectNamePlural}/merge`, input),
};

/** One possible-duplicate match — powers the record detail page's "Possible Duplicates" section. */
export interface DuplicateMatch {
  recordId: string;
  label: string;
}

export interface ImportSummary {
  created: number;
  failed: number;
  errors: { row: number; message: string }[];
}

/** Generic file upload backing the record Files tab's attachment records. */
export const filesApi = {
  upload: (file: File) => {
    const form = new FormData();
    form.set('file', file);
    return postForm<{ id: string; url: string }>('/files/upload', form);
  },

  remove: (id: string) => del<{ ok: true }>(`/files/${id}`),
};

/** Extracts the file id from a stored `/files/:id` path (attachments persist a host-relative path). */
export function fileIdFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const match = /\/files\/([^/?#]+)/.exec(url);
  return match?.[1] ?? null;
}

// ---- Saved views (Phase 6) ----

export interface View {
  id: string;
  objectMetadataId: string;
  name: string;
  type: 'TABLE' | 'KANBAN';
  icon: string | null;
  position: number;
  isCompact: boolean;
  isDefault: boolean;
  kanbanFieldMetadataId: string | null;
}

export interface ViewFieldConfig {
  fieldMetadataId: string;
  position: number;
  isVisible: boolean;
  size: number;
}

export interface ViewFilterConfig {
  id: string;
  fieldMetadataId: string;
  operand: string;
  value: unknown;
  position: number;
}

export interface ViewSortConfig {
  fieldMetadataId: string;
  direction: 'ASC' | 'DESC';
}

export interface ViewGroupConfig {
  fieldValue: string;
  isVisible: boolean;
  position: number;
}

export interface ViewDetail extends View {
  fields: ViewFieldConfig[];
  filters: ViewFilterConfig[];
  sorts: ViewSortConfig[];
  groups: ViewGroupConfig[];
}

export const viewApi = {
  list: (objectMetadataId: string) => get<View[]>(`/views?objectMetadataId=${objectMetadataId}`),

  get: (id: string) => get<ViewDetail>(`/views/${id}`),

  create: (input: { objectMetadataId: string; name: string; type?: 'TABLE' | 'KANBAN'; icon?: string }) =>
    post<View>('/views', input),

  update: (
    id: string,
    input: Partial<{ name: string; icon: string | null; isCompact: boolean; kanbanFieldMetadataId: string | null; position: number }>,
  ) => patch<View>(`/views/${id}`, input),

  remove: (id: string) => del<{ ok: true }>(`/views/${id}`),

  setFields: (id: string, fields: { fieldMetadataId: string; isVisible: boolean; size: number }[]) =>
    put<ViewFieldConfig[]>(`/views/${id}/fields`, fields),

  setFilters: (id: string, filters: { fieldMetadataId: string; operand: string; value?: unknown }[]) =>
    put<ViewFilterConfig[]>(`/views/${id}/filters`, filters),

  setSorts: (id: string, sorts: { fieldMetadataId: string; direction: 'ASC' | 'DESC' }[]) =>
    put<ViewSortConfig[]>(`/views/${id}/sorts`, sorts),

  setGroups: (id: string, groups: { fieldValue: string; isVisible: boolean }[]) =>
    put<ViewGroupConfig[]>(`/views/${id}/groups`, groups),
};

export const dashboardApi = {
  list: () => get<DashboardSummary[]>('/dashboards'),

  get: (id: string) => get<DashboardDetail>(`/dashboards/${id}`),

  create: (title: string) => post<DashboardDetail>('/dashboards', { title }),

  update: (id: string, title: string) => patch<DashboardDetail>(`/dashboards/${id}`, { title }),

  remove: (id: string) => del<{ ok: true }>(`/dashboards/${id}`),

  saveLayout: (id: string, input: SaveDashboardLayoutRequest) =>
    put<DashboardDetail>(`/dashboards/${id}/layout`, input),

  chartData: (input: ChartDataRequest) => post<ChartDataResponse>('/dashboards/chart-data', input),
};

export const workflowApi = {
  list: () => get<WorkflowSummary[]>('/workflows'),

  get: (id: string) => get<WorkflowDetail>(`/workflows/${id}`),

  create: (name: string) => post<WorkflowDetail>('/workflows', { name }),

  update: (id: string, name: string) => patch<WorkflowDetail>(`/workflows/${id}`, { name }),

  remove: (id: string) => del<{ ok: true }>(`/workflows/${id}`),

  // Returns the editable DRAFT version (forking one from the active version if needed).
  getDraft: (id: string) => get<WorkflowVersionDetail>(`/workflows/${id}/draft`),

  updateVersion: (id: string, versionId: string, input: UpdateWorkflowVersionRequest) =>
    patch<WorkflowVersionDetail>(`/workflows/${id}/versions/${versionId}`, input),

  listVersions: (id: string) => get<WorkflowVersionSummary[]>(`/workflows/${id}/versions`),

  discardDraft: (id: string) => del<WorkflowDetail>(`/workflows/${id}/draft`),

  activate: (id: string) => post<WorkflowDetail>(`/workflows/${id}/activate`),

  deactivate: (id: string) => post<WorkflowDetail>(`/workflows/${id}/deactivate`),

  duplicate: (id: string) => post<WorkflowDetail>(`/workflows/${id}/duplicate`),

  run: (id: string, payload?: Record<string, unknown>) =>
    post<WorkflowRunSummary>(`/workflows/${id}/run`, { payload: payload ?? {} }),

  listRuns: (params?: { workflowId?: string; status?: string; page?: number; pageSize?: number }) => {
    const q = new URLSearchParams();
    if (params?.workflowId) q.set('workflowId', params.workflowId);
    if (params?.status) q.set('status', params.status);
    if (params?.page) q.set('page', String(params.page));
    if (params?.pageSize) q.set('pageSize', String(params.pageSize));
    const qs = q.toString();
    return get<{ items: WorkflowRunSummary[]; total: number; page: number; pageSize: number }>(
      `/workflows/runs${qs ? `?${qs}` : ''}`,
    );
  },

  getRun: (runId: string) => get<WorkflowRunDetail>(`/workflows/runs/${runId}`),

  testHttp: (input: { url?: string; method?: string; headers?: Record<string, string>; body?: string }) =>
    post<{ status?: number; ok?: boolean; body?: unknown; durationMs?: number; error?: string }>(
      '/workflows/test/http',
      input,
    ),

  testCode: (code: string, params: Record<string, unknown>) =>
    post<{ result?: unknown; error?: string; durationMs?: number }>('/workflows/test/code', { code, params }),

  listRunnable: (availability: ManualTriggerAvailability, objectName?: string) => {
    const q = new URLSearchParams({ availability });
    if (objectName) q.set('objectName', objectName);
    return get<WorkflowRunnableSummary[]>(`/workflows/runnable?${q.toString()}`);
  },

  getPendingForm: (runId: string, stepId: string) => get<PendingForm>(`/workflows/runs/${runId}/form/${stepId}`),

  submitPendingForm: (runId: string, stepId: string, values: Record<string, unknown>) =>
    post<{ ok: true }>(`/workflows/runs/${runId}/form/${stepId}`, { values }),
};

export interface PendingForm {
  workflowName: string;
  status: string;
  title: string;
  fields: { id: string; name: string; label: string; type: string }[];
}

/** One cross-object match — powers the ⌘K command menu's quick-jump results. */
export interface SearchResult {
  objectMetadataId: string;
  objectNamePlural: string;
  objectLabel: string;
  icon: string | null;
  recordId: string;
  label: string;
  rank: number;
}

export const searchApi = {
  search: (q: string) => get<SearchResult[]>(`/search?q=${encodeURIComponent(q)}`),
};
