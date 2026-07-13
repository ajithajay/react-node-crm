import { z } from 'zod';

export const auditLogQuerySchema = z.object({
  action: z.string().min(1).optional(),
  actorUserId: z.string().uuid().optional(),
  from: z.string().optional(), // ISO date (inclusive lower bound on created_at)
  to: z.string().optional(), // ISO date (inclusive upper bound)
  search: z.string().trim().min(1).optional(), // free-text over action string
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
  'workspace.deleted',
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
  'api_key.created',
  'api_key.revoked',
  'webhook.created',
  'webhook.updated',
  'webhook.deleted',
  'webhook.secret_regenerated',
  'dashboard.created',
  'dashboard.updated',
  'dashboard.deleted',
  'dashboard.layout_updated',
] as const;
export type AuditLogAction = (typeof AUDIT_LOG_ACTIONS)[number];
