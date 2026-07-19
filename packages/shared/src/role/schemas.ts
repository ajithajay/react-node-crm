import { z } from 'zod';
import { PermissionFlagType } from '../metadata/permission-flag.js';
import { ViewFilterOperand } from '../metadata/view-type.js';
import { LogicalOperator, RowLevelPermissionValueMode } from './row-level-permission-type.js';

/** Just a label — the internal `name` slug is derived server-side. */
export const createRoleRequestSchema = z.object({
  label: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500).nullish(),
});
export type CreateRoleRequest = z.infer<typeof createRoleRequestSchema>;

export const updateRoleRequestSchema = z.object({
  label: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500).nullish(),
  icon: z.string().trim().min(1).max(50),
  canUpdateAllSettings: z.boolean(),
  canReadAllObjectRecords: z.boolean(),
  canUpdateAllObjectRecords: z.boolean(),
  canSoftDeleteAllObjectRecords: z.boolean(),
  canDestroyAllObjectRecords: z.boolean(),
  canAccessAllTools: z.boolean(),
});
export type UpdateRoleRequest = z.infer<typeof updateRoleRequestSchema>;

const permissionFlagValues = Object.values(PermissionFlagType) as [string, ...string[]];
export const permissionFlagSchema = z.enum(permissionFlagValues);

export const updateSettingsPermissionsRequestSchema = z.object({
  flags: z.array(permissionFlagSchema),
});
export type UpdateSettingsPermissionsRequest = z.infer<typeof updateSettingsPermissionsRequestSchema>;

/**
 * Partial patch — omitted keys are left untouched, `null` resets that permission back to
 * "inherit the role's blanket flag" (a tri-state object-permission model).
 */
export const updateObjectPermissionRequestSchema = z.object({
  canRead: z.boolean().nullable().optional(),
  canUpdate: z.boolean().nullable().optional(),
  canSoftDelete: z.boolean().nullable().optional(),
  canDestroy: z.boolean().nullable().optional(),
});
export type UpdateObjectPermissionRequest = z.infer<typeof updateObjectPermissionRequestSchema>;

/**
 * Field permissions are pure restrictions layered on top of object-level access: `canRead`/
 * `canUpdate` can only ever be `false` (restricted) or `null` (inherit, i.e. not restricted) —
 * there's no explicit `true` grant at the field level.
 */
export const updateFieldPermissionRequestSchema = z.object({
  canRead: z.literal(false).nullable().optional(),
  canUpdate: z.literal(false).nullable().optional(),
});
export type UpdateFieldPermissionRequest = z.infer<typeof updateFieldPermissionRequestSchema>;

/**
 * One condition in a row-level permission rule: "<field> <operand> <value>", where value is
 * either a literal or the CURRENT_USER token (resolved against the caller's workspace member at
 * query time). `logicalOperator` says how this condition joins the *previous* one in the rule's
 * ordered list — ignored on the first condition. Flat list only, no nested AND/OR groups (v1 scope).
 */
const operandValues = Object.values(ViewFilterOperand) as [string, ...string[]];
const valueModeValues = Object.values(RowLevelPermissionValueMode) as [string, ...string[]];
const logicalOperatorValues = Object.values(LogicalOperator) as [string, ...string[]];

export const rowLevelPermissionConditionSchema = z.object({
  fieldMetadataId: z.string().uuid(),
  operand: z.enum(operandValues),
  valueMode: z.enum(valueModeValues).default(RowLevelPermissionValueMode.LITERAL),
  value: z.unknown().optional(),
  logicalOperator: z.enum(logicalOperatorValues).default(LogicalOperator.AND),
});
export type RowLevelPermissionCondition = z.infer<typeof rowLevelPermissionConditionSchema>;

/** Replaces the full rule (ordered condition list) for a role+object in one call. Empty array clears it. */
export const replaceRowLevelPermissionsRequestSchema = z.object({
  conditions: z.array(rowLevelPermissionConditionSchema).max(20),
});
export type ReplaceRowLevelPermissionsRequest = z.infer<typeof replaceRowLevelPermissionsRequestSchema>;

export const reassignMemberRoleRequestSchema = z.object({
  roleId: z.string().uuid(),
});
export type ReassignMemberRoleRequest = z.infer<typeof reassignMemberRoleRequestSchema>;
