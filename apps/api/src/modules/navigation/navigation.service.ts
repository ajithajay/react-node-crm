import { IsNull } from 'typeorm';
import { NavigationMenuItemEntity, ObjectMetadataEntity, WorkspaceMemberEntity } from '@saasly/database';
import type { CreateNavigationMenuItemRequest, UpdateNavigationMenuItemRequest } from '@saasly/shared';
import { dataSource } from '../../lib/db.js';
import { NotFoundError } from '../../lib/errors.js';

const repo = () => dataSource.getRepository(NavigationMenuItemEntity);
const objectRepo = () => dataSource.getRepository(ObjectMetadataEntity);

const DEFAULT_SIDEBAR_OBJECT_ORDER = ['company', 'person', 'opportunity', 'task', 'note'];

async function resolveMemberId(userId: string, workspaceId: string): Promise<string> {
  const member = await dataSource.getRepository(WorkspaceMemberEntity).findOneBy({ userId, workspaceId });
  if (!member) throw new NotFoundError('Workspace member not found');
  return member.id;
}

/** Every real object (standard or custom) only appears in the sidebar as an explicit
 * navigation_menu_item — there's no separate "Favorites" bucket. New members get the 5 standard
 * objects seeded once (lazily, on first read), matching this project's synthesize-on-read pattern
 * (e.g. `page-layout.service.ts#getPageLayout`) rather than a provisioning-time write. Dashboards and
 * Workflows have no backing object metadata, so they're seeded as plain LINK/FOLDER items instead. */
async function seedDefaultItemsIfEmpty(workspaceId: string, workspaceMemberId: string): Promise<void> {
  const existing = await repo().count({ where: { workspaceId, workspaceMemberId } });
  if (existing > 0) return;

  const objects = await objectRepo().find({ where: { workspaceId, isActive: true } });
  const objectByName = new Map(objects.map((o) => [o.nameSingular, o]));

  const toSeed = DEFAULT_SIDEBAR_OBJECT_ORDER.map((name) => objectByName.get(name)).filter(
    (o): o is ObjectMetadataEntity => !!o,
  );

  let position = 0;
  if (toSeed.length) {
    await repo().save(
      toSeed.map((object) =>
        repo().create({
          workspaceId,
          workspaceMemberId,
          type: 'OBJECT',
          label: object.labelPlural,
          icon: object.icon,
          color: null,
          folderId: null,
          targetObjectMetadataId: object.id,
          viewId: null,
          link: null,
          position: position++,
        }),
      ),
    );
  }

  await repo().save(
    repo().create({
      workspaceId,
      workspaceMemberId,
      type: 'LINK',
      label: 'Dashboards',
      icon: 'LayoutDashboard',
      color: null,
      folderId: null,
      targetObjectMetadataId: null,
      viewId: null,
      link: '/dashboards',
      position: position++,
    }),
  );

  const workflowsFolder = await repo().save(
    repo().create({
      workspaceId,
      workspaceMemberId,
      type: 'FOLDER',
      label: 'Workflows',
      icon: 'Workflow',
      color: null,
      folderId: null,
      targetObjectMetadataId: null,
      viewId: null,
      link: null,
      position: position++,
    }),
  );
  await repo().save(
    [
      { label: 'All Workflows', link: '/workflows' },
      { label: 'All Runs', link: '/workflows/runs' },
    ].map((child, childPosition) =>
      repo().create({
        workspaceId,
        workspaceMemberId,
        type: 'LINK',
        label: child.label,
        icon: null,
        color: null,
        folderId: workflowsFolder.id,
        targetObjectMetadataId: null,
        viewId: null,
        link: child.link,
        position: childPosition,
      }),
    ),
  );
}

export async function listItems(workspaceId: string, userId: string): Promise<NavigationMenuItemEntity[]> {
  const workspaceMemberId = await resolveMemberId(userId, workspaceId);
  await seedDefaultItemsIfEmpty(workspaceId, workspaceMemberId);
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
      color: input.color ?? null,
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
  if (input.color !== undefined) item.color = input.color;
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
