import { RoleEntity, WorkspaceEntity } from '@saasly/database';
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
  logoUrl: string | null;
  defaultRoleId: string | null;
}

function toResponse(workspace: WorkspaceEntity): CurrentWorkspaceResponse {
  return {
    id: workspace.id,
    name: workspace.name,
    subdomain: workspace.subdomain,
    logoUrl: workspace.logoUrl,
    defaultRoleId: workspace.defaultRoleId,
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
  await workspaceRepo().save(workspace);

  await record(workspaceId, actorUserId, 'workspace.updated', {
    before,
    after: { name: workspace.name, subdomain: workspace.subdomain },
  });

  return toResponse(workspace);
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
