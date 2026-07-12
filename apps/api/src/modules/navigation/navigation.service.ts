import { IsNull } from 'typeorm';
import { NavigationMenuItemEntity, WorkspaceMemberEntity } from '@saasly/database';
import type { CreateNavigationMenuItemRequest, UpdateNavigationMenuItemRequest } from '@saasly/shared';
import { dataSource } from '../../lib/db.js';
import { NotFoundError } from '../../lib/errors.js';

const repo = () => dataSource.getRepository(NavigationMenuItemEntity);

async function resolveMemberId(userId: string, workspaceId: string): Promise<string> {
  const member = await dataSource.getRepository(WorkspaceMemberEntity).findOneBy({ userId, workspaceId });
  if (!member) throw new NotFoundError('Workspace member not found');
  return member.id;
}

export async function listItems(workspaceId: string, userId: string): Promise<NavigationMenuItemEntity[]> {
  const workspaceMemberId = await resolveMemberId(userId, workspaceId);
  return repo().find({ where: { workspaceId, workspaceMemberId }, order: { position: 'ASC' } });
}

export async function createItem(
  workspaceId: string,
  userId: string,
  input: CreateNavigationMenuItemRequest,
): Promise<NavigationMenuItemEntity> {
  const workspaceMemberId = await resolveMemberId(userId, workspaceId);
  const siblings = await repo().find({
    where: { workspaceId, workspaceMemberId, folderId: input.folderId ?? IsNull() },
    order: { position: 'DESC' },
    take: 1,
  });
  const position = (siblings[0]?.position ?? -1) + 1;

  return repo().save(
    repo().create({
      workspaceId,
      workspaceMemberId,
      type: input.type,
      label: input.label,
      icon: input.icon ?? null,
      folderId: input.folderId ?? null,
      targetObjectMetadataId: input.targetObjectMetadataId ?? null,
      viewId: input.viewId ?? null,
      link: input.link ?? null,
      position,
    }),
  );
}

export async function updateItem(
  workspaceId: string,
  userId: string,
  id: string,
  input: UpdateNavigationMenuItemRequest,
): Promise<NavigationMenuItemEntity> {
  const workspaceMemberId = await resolveMemberId(userId, workspaceId);
  const item = await repo().findOneBy({ id, workspaceId, workspaceMemberId });
  if (!item) throw new NotFoundError('Navigation item not found');

  if (input.label !== undefined) item.label = input.label;
  if (input.icon !== undefined) item.icon = input.icon;
  if (input.folderId !== undefined) item.folderId = input.folderId;
  if (input.position !== undefined) item.position = input.position;
  return repo().save(item);
}

export async function deleteItem(workspaceId: string, userId: string, id: string): Promise<void> {
  const workspaceMemberId = await resolveMemberId(userId, workspaceId);
  const item = await repo().findOneBy({ id, workspaceId, workspaceMemberId });
  if (!item) throw new NotFoundError('Navigation item not found');
  await repo().remove(item); // FK cascade removes a folder's children
}
