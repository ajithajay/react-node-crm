import type { WorkspaceMemberEntity } from '@saasly/database';
import { workspaceDataSourceCache } from './workspace-data-source.js';

/**
 * Mirrors a core `WorkspaceMemberEntity` row's display name into the workspace's own dynamic
 * `workspace_member` standard object (seeded per-workspace since Phase 5h, but never populated
 * until now — Company's `Account Owner` RELATION points at this table, so it needs real rows to
 * be pickable at all). The dynamic row's `id` is kept identical to the core member's `id`, so a
 * relation FK value picked in the UI resolves directly — no separate mapping table needed.
 */
export async function syncWorkspaceMemberRecord(
  workspaceId: string,
  member: WorkspaceMemberEntity,
  email?: string,
): Promise<void> {
  const workspaceDataSource = await workspaceDataSourceCache.getWorkspaceDataSource(workspaceId);
  const repo = workspaceDataSource.getRepository('workspace_member');
  await repo.save(
    repo.create({
      id: member.id,
      name_first_name: member.firstName,
      name_last_name: member.lastName,
      // Email lets the Account Owner picker show a real identifier for a member who hasn't set a
      // name yet, instead of a raw id (gap A2). Omitted on profile updates (email is immutable).
      ...(email !== undefined ? { email } : {}),
    }),
  );
}
