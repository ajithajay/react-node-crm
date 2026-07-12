import { RoleEntity, WorkspaceEntity, dropWorkspaceSchema } from '@saasly/database';
import type { UpdateWorkspaceRequest } from '@saasly/shared';
import { dataSource } from '../../lib/db.js';
import { ConflictError, NotFoundError } from '../../lib/errors.js';
import { checkSubdomainAvailability } from '../auth/auth.service.js';
import { uploadFile, deleteFile, fileIdFromUrl } from '../file/file.service.js';
import { record } from '../audit-log/audit-log.service.js';

const workspaceRepo = () => dataSource.getRepository(WorkspaceEntity);

export interface CurrentWorkspaceResponse {
  id: string;
  name: string;
  subdomain: string;
  customDomain: string | null;
  logoUrl: string | null;
  defaultRoleId: string | null;
  editableProfileFields: string[];
}

function toResponse(workspace: WorkspaceEntity): CurrentWorkspaceResponse {
  return {
    id: workspace.id,
    name: workspace.name,
    subdomain: workspace.subdomain,
    customDomain: workspace.customDomain,
    logoUrl: workspace.logoUrl,
    defaultRoleId: workspace.defaultRoleId,
    editableProfileFields: workspace.editableProfileFields ?? [],
  };
}

export async function getCurrentWorkspace(workspaceId: string): Promise<CurrentWorkspaceResponse> {
  const workspace = await workspaceRepo().findOneByOrFail({ id: workspaceId });
  return toResponse(workspace);
}

export async function updateWorkspace(
  workspaceId: string,
  actorUserId: string,
  input: UpdateWorkspaceRequest,
): Promise<CurrentWorkspaceResponse> {
  const workspace = await workspaceRepo().findOneByOrFail({ id: workspaceId });
  const nextSubdomain = input.subdomain.trim().toLowerCase();

  if (nextSubdomain !== workspace.subdomain) {
    const availability = await checkSubdomainAvailability(nextSubdomain);
    if (!availability.available) throw new ConflictError(`Subdomain unavailable: ${availability.reason}`);
  }

  const before = { name: workspace.name, subdomain: workspace.subdomain };
  workspace.name = input.name;
  workspace.subdomain = nextSubdomain;
  if (input.editableProfileFields !== undefined) workspace.editableProfileFields = input.editableProfileFields;
  await workspaceRepo().save(workspace);

  await record(workspaceId, actorUserId, 'workspace.updated', {
    before,
    after: { name: workspace.name, subdomain: workspace.subdomain },
  });

  return toResponse(workspace);
}

/**
 * Hard-deletes a workspace: drops its data-plane schema and deletes the core `workspaces` row, which
 * cascades to members/invitations/roles/views/metadata via the FK `ON DELETE CASCADE`s (gap C1).
 * The caller (controller) is responsible for signing the user out afterward. Guarded by the WORKSPACE
 * settings permission at the route.
 */
export async function deleteWorkspace(workspaceId: string, actorUserId: string): Promise<void> {
  const workspace = await workspaceRepo().findOneByOrFail({ id: workspaceId });
  await record(workspaceId, actorUserId, 'workspace.deleted', { subdomain: workspace.subdomain });
  await dataSource.transaction(async (manager) => {
    await dropWorkspaceSchema(manager.queryRunner!, workspace.databaseSchema);
    await manager.getRepository(WorkspaceEntity).delete({ id: workspaceId });
  });
}

export async function uploadLogo(
  workspaceId: string,
  actorUserId: string,
  buffer: Buffer,
  originalName: string,
  mimeType: string,
): Promise<{ logoUrl: string }> {
  const workspace = await workspaceRepo().findOneByOrFail({ id: workspaceId });
  const previousFileId = fileIdFromUrl(workspace.logoUrl);

  const uploaded = await uploadFile(workspaceId, buffer, originalName, mimeType, 'logos');
  workspace.logoUrl = uploaded.url;
  await workspaceRepo().save(workspace);

  if (previousFileId) await deleteFile(previousFileId, workspaceId);
  await record(workspaceId, actorUserId, 'workspace.updated', { field: 'logoUrl' });
  return { logoUrl: uploaded.url };
}

export async function removeLogo(workspaceId: string, actorUserId: string): Promise<void> {
  const workspace = await workspaceRepo().findOneByOrFail({ id: workspaceId });
  const previousFileId = fileIdFromUrl(workspace.logoUrl);

  workspace.logoUrl = null;
  await workspaceRepo().save(workspace);

  if (previousFileId) await deleteFile(previousFileId, workspaceId);
  await record(workspaceId, actorUserId, 'workspace.updated', { field: 'logoUrl', removed: true });
}

export async function setDefaultRole(workspaceId: string, actorUserId: string, roleId: string): Promise<void> {
  const role = await dataSource.getRepository(RoleEntity).findOneBy({ id: roleId, workspaceId });
  if (!role) throw new NotFoundError('Role not found');

  const workspace = await workspaceRepo().findOneByOrFail({ id: workspaceId });
  const previousRoleId = workspace.defaultRoleId;
  workspace.defaultRoleId = roleId;
  await workspaceRepo().save(workspace);

  await record(workspaceId, actorUserId, 'workspace.default_role_changed', { previousRoleId, roleId });
}
