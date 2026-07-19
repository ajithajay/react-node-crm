/**
 * A rule's value is either a literal (compared as-is) or the special "current user" token,
 * resolved at query time against the caller's workspace-member id (e.g. "Owner IS current user").
 * API-key callers have no workspace member, so CURRENT_USER conditions never match for them —
 * a conservative default (see apps/api/src/modules/record/row-level-permission.ts).
 */
export const RowLevelPermissionValueMode = {
  LITERAL: 'LITERAL',
  CURRENT_USER: 'CURRENT_USER',
} as const;
export type RowLevelPermissionValueMode = (typeof RowLevelPermissionValueMode)[keyof typeof RowLevelPermissionValueMode];

/** How this condition combines with the *previous* one in the rule's ordered list; ignored on the first condition. */
export const LogicalOperator = {
  AND: 'AND',
  OR: 'OR',
} as const;
export type LogicalOperator = (typeof LogicalOperator)[keyof typeof LogicalOperator];
