import {
  FieldPermissionEntity,
  ObjectPermissionEntity,
  RoleEntity,
  WorkspaceEntity,
  WorkspaceMemberEntity,
} from '@saasly/database';
import { dataSource } from '../../lib/db.js';
import { ForbiddenError, UnauthorizedError } from '../../lib/errors.js';

/** Who is acting on a record request — a logged-in user (member) or an API key (role, no member). */
export type Principal =
  | { type: 'user'; userId: string }
  | { type: 'apiKey'; apiKeyId: string; roleId: string | null; name: string };

export type ObjectAction = 'read' | 'update' | 'softDelete' | 'destroy';

const BLANKET_FLAG_BY_ACTION: Record<ObjectAction, keyof RoleEntity> = {
  read: 'canReadAllObjectRecords',
  update: 'canUpdateAllObjectRecords',
  softDelete: 'canSoftDeleteAllObjectRecords',
  destroy: 'canDestroyAllObjectRecords',
};

const OVERRIDE_FIELD_BY_ACTION: Record<ObjectAction, keyof ObjectPermissionEntity> = {
  read: 'canRead',
  update: 'canUpdate',
  softDelete: 'canSoftDelete',
  destroy: 'canDestroy',
};

/** The caller's resolved role (+ member, for a user) — reused across a request's permission checks and ACTOR stamping. */
export interface ActorRole {
  role: RoleEntity;
  member?: WorkspaceMemberEntity;
  apiKeyName?: string;
}

export async function resolveActorRole(principal: Principal, workspaceId: string): Promise<ActorRole> {
  if (principal.type === 'apiKey') {
    // An API key's role is assigned directly; fall back to the workspace default role if unset.
    let roleId = principal.roleId;
    if (!roleId) {
      const workspace = await dataSource.getRepository(WorkspaceEntity).findOneBy({ id: workspaceId });
      roleId = workspace?.defaultRoleId ?? null;
    }
    const role = roleId ? await dataSource.getRepository(RoleEntity).findOneBy({ id: roleId, workspaceId }) : null;
    if (!role) throw new UnauthorizedError('API key has no role');
    return { role, apiKeyName: principal.name };
  }

  const member = await dataSource
    .getRepository(WorkspaceMemberEntity)
    .findOneBy({ userId: principal.userId, workspaceId });
  if (!member?.roleId) throw new UnauthorizedError('No workspace membership found');

  const role = await dataSource.getRepository(RoleEntity).findOneBy({ id: member.roleId });
  if (!role) throw new UnauthorizedError('Role not found');

  return { role, member };
}

/**
 * Tri-state resolution matching Settings → Roles → Permissions (Phase 5e): an explicit
 * object-level override wins; otherwise fall back to the role's blanket `canXAllObjectRecords` flag.
 */
export async function assertObjectAccess(
  actor: ActorRole,
  objectMetadataId: string,
  action: ObjectAction,
): Promise<void> {
  if (actor.role.canUpdateAllSettings) return; // Admin superset — same rule as permission-guard.ts

  const override = await dataSource
    .getRepository(ObjectPermissionEntity)
    .findOneBy({ roleId: actor.role.id, objectMetadataId });

  const overrideValue = override?.[OVERRIDE_FIELD_BY_ACTION[action]] as boolean | null | undefined;
  const resolved = overrideValue ?? actor.role[BLANKET_FLAG_BY_ACTION[action]];
  if (!resolved) throw new ForbiddenError(`Your role cannot ${action} records on this object`);
}

/** fieldMetadataIds this role can't read/write on the given object — restrictions only (no explicit grants). */
export async function resolveFieldRestrictions(
  actor: ActorRole,
  fieldMetadataIds: string[],
): Promise<{ restrictedForRead: Set<string>; restrictedForWrite: Set<string> }> {
  if (actor.role.canUpdateAllSettings || fieldMetadataIds.length === 0) {
    return { restrictedForRead: new Set(), restrictedForWrite: new Set() };
  }

  const permissions = await dataSource
    .getRepository(FieldPermissionEntity)
    .createQueryBuilder('fp')
    .where('fp.role_id = :roleId', { roleId: actor.role.id })
    .andWhere('fp.field_metadata_id IN (:...ids)', { ids: fieldMetadataIds })
    .getMany();

  const restrictedForRead = new Set<string>();
  const restrictedForWrite = new Set<string>();
  for (const p of permissions) {
    if (p.canRead === false) restrictedForRead.add(p.fieldMetadataId);
    if (p.canUpdate === false) restrictedForWrite.add(p.fieldMetadataId);
  }
  return { restrictedForRead, restrictedForWrite };
}
