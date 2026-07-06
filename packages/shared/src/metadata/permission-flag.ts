/** Fine-grained settings/tool permission flags assignable to a role (BRD §8). */
export const PermissionFlagType = {
  DATA_MODEL: 'DATA_MODEL',
  WORKSPACE: 'WORKSPACE',
  WORKSPACE_MEMBERS: 'WORKSPACE_MEMBERS',
  ROLES: 'ROLES',
  SECURITY: 'SECURITY',
  API_KEYS_AND_WEBHOOKS: 'API_KEYS_AND_WEBHOOKS',
  LAYOUTS: 'LAYOUTS',
  WORKFLOWS: 'WORKFLOWS',
  VIEWS: 'VIEWS',
  IMPORT_CSV: 'IMPORT_CSV',
  EXPORT_CSV: 'EXPORT_CSV',
  UPLOAD_FILE: 'UPLOAD_FILE',
} as const;
export type PermissionFlagType = (typeof PermissionFlagType)[keyof typeof PermissionFlagType];

export const StandardRoleName = {
  ADMIN: 'Admin',
  MEMBER: 'Member',
  GUEST: 'Guest',
} as const;
export type StandardRoleName = (typeof StandardRoleName)[keyof typeof StandardRoleName];
