import { z } from 'zod';

export const auditLogQuerySchema = z.object({
  action: z.string().min(1).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type AuditLogQuery = z.infer<typeof auditLogQuerySchema>;

/** Actions actually recorded (§7.1) — kept as a plain union, not a DB enum, so new ones are cheap to add. */
export const AUDIT_LOG_ACTIONS = [
  'auth.login',
  'auth.password_changed',
  'auth.two_factor_enabled',
  'auth.two_factor_disabled',
  'workspace.updated',
  'workspace.default_role_changed',
  'member.invited',
  'member.invite_resent',
  'member.invite_revoked',
  'member.joined',
  'member.role_changed',
  'role.created',
  'role.updated',
  'role.deleted',
  'role.permissions_updated',
  'data_model.object_created',
  'data_model.object_updated',
  'data_model.object_deleted',
  'data_model.field_created',
  'data_model.field_updated',
  'data_model.field_deleted',
  'data_model.relation_created',
] as const;
export type AuditLogAction = (typeof AUDIT_LOG_ACTIONS)[number];
