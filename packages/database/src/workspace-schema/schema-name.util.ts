/** Matches schema names produced by getWorkspaceSchemaName — safe to interpolate into raw DDL. */
export const WORKSPACE_SCHEMA_NAME_REGEX = /^workspace_[0-9a-z]+$/;

/**
 * Deterministic per-workspace schema name: `workspace_<base36(uuid)>`.
 * (solution-approach.md §4.1 — mirrors Twenty's `getWorkspaceSchemaName`.)
 */
export function getWorkspaceSchemaName(workspaceId: string): string {
  const hex = workspaceId.replace(/-/g, '');
  if (!/^[0-9a-f]{32}$/i.test(hex)) {
    throw new Error(`Invalid workspace id (expected a UUID): "${workspaceId}"`);
  }
  const base36 = BigInt(`0x${hex}`).toString(36);
  return `workspace_${base36}`;
}
