import { In } from 'typeorm';
import {
  FieldMetadataEntity,
  FieldPermissionEntity,
  ObjectMetadataEntity,
  ObjectPermissionEntity,
  RoleEntity,
  RolePermissionFlagEntity,
  RowLevelPermissionEntity,
  UserEntity,
  WorkspaceEntity,
  WorkspaceMemberEntity,
} from '@saasly/database';
import {
  FieldMetadataType,
  RowLevelPermissionValueMode,
  ViewFilterOperand,
  type CreateRoleRequest,
  type UpdateRoleRequest,
  type UpdateSettingsPermissionsRequest,
  type UpdateObjectPermissionRequest,
  type UpdateFieldPermissionRequest,
  type ReplaceRowLevelPermissionsRequest,
  type LogicalOperator,
} from '@saasly/shared';
import { dataSource } from '../../lib/db.js';
import { ConflictError, ForbiddenError, NotFoundError } from '../../lib/errors.js';
import { buildFilterableFieldIndex } from '../../lib/query-parser.js';
import { record } from '../audit-log/audit-log.service.js';

const roleRepo = () => dataSource.getRepository(RoleEntity);
const flagRepo = () => dataSource.getRepository(RolePermissionFlagEntity);
const objectPermissionRepo = () => dataSource.getRepository(ObjectPermissionEntity);
const fieldPermissionRepo = () => dataSource.getRepository(FieldPermissionEntity);
const rowLevelPermissionRepo = () => dataSource.getRepository(RowLevelPermissionEntity);
const memberRepo = () => dataSource.getRepository(WorkspaceMemberEntity);
const workspaceRepo = () => dataSource.getRepository(WorkspaceEntity);

export interface RoleSummary {
  id: string;
  name: string;
  label: string;
  icon: string;
  isEditable: boolean;
}

export interface RoleDetail extends RoleSummary {
  description: string | null;
  canUpdateAllSettings: boolean;
  canReadAllObjectRecords: boolean;
  canUpdateAllObjectRecords: boolean;
  canSoftDeleteAllObjectRecords: boolean;
  canDestroyAllObjectRecords: boolean;
  canAccessAllTools: boolean;
  memberCount: number;
}

function toSummary(role: RoleEntity): RoleSummary {
  return { id: role.id, name: role.name, label: role.label, icon: role.icon, isEditable: role.isEditable };
}

/** Derives a unique internal slug from the label, e.g. "Sales Rep" -> "sales-rep", "-2" if taken. */
async function generateUniqueRoleName(workspaceId: string, label: string): Promise<string> {
  const base = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'role';

  for (let suffix = 1; ; suffix += 1) {
    const candidate = suffix === 1 ? base : `${base}-${suffix}`;
    const existing = await roleRepo().findOneBy({ workspaceId, name: candidate });
    if (!existing) return candidate;
  }
}

async function toDetail(role: RoleEntity): Promise<RoleDetail> {
  const memberCount = await memberRepo().count({ where: { roleId: role.id } });
  return {
    ...toSummary(role),
    description: role.description,
    canUpdateAllSettings: role.canUpdateAllSettings,
    canReadAllObjectRecords: role.canReadAllObjectRecords,
    canUpdateAllObjectRecords: role.canUpdateAllObjectRecords,
    canSoftDeleteAllObjectRecords: role.canSoftDeleteAllObjectRecords,
    canDestroyAllObjectRecords: role.canDestroyAllObjectRecords,
    canAccessAllTools: role.canAccessAllTools,
    memberCount,
  };
}

export async function listRoles(workspaceId: string): Promise<RoleSummary[]> {
  const roles = await roleRepo().findBy({ workspaceId });
  return roles.map(toSummary);
}

export async function getRole(workspaceId: string, roleId: string): Promise<RoleDetail> {
  const role = await roleRepo().findOneBy({ id: roleId, workspaceId });
  if (!role) throw new NotFoundError('Role not found');
  return toDetail(role);
}

export async function createRole(
  workspaceId: string,
  actorUserId: string,
  input: CreateRoleRequest,
): Promise<RoleDetail> {
  const existingLabel = await roleRepo().findOneBy({ workspaceId, label: input.label });
  if (existingLabel) throw new ConflictError('A role with this label already exists');

  const name = await generateUniqueRoleName(workspaceId, input.label);

  const role = await roleRepo().save(
    roleRepo().create({
      workspaceId,
      name,
      label: input.label,
      icon: 'User',
      description: input.description ?? null,
      isEditable: true,
      canUpdateAllSettings: false,
      canReadAllObjectRecords: true,
      canUpdateAllObjectRecords: false,
      canSoftDeleteAllObjectRecords: false,
      canDestroyAllObjectRecords: false,
      canAccessAllTools: false,
    }),
  );

  await record(workspaceId, actorUserId, 'role.created', { roleId: role.id, name: role.name });
  return toDetail(role);
}

export async function updateRole(
  workspaceId: string,
  roleId: string,
  actorUserId: string,
  input: UpdateRoleRequest,
): Promise<RoleDetail> {
  const role = await roleRepo().findOneBy({ id: roleId, workspaceId });
  if (!role) throw new NotFoundError('Role not found');
  if (!role.isEditable) throw new ForbiddenError('This role cannot be edited');

  role.label = input.label;
  role.description = input.description ?? null;
  role.icon = input.icon;
  role.canUpdateAllSettings = input.canUpdateAllSettings;
  role.canReadAllObjectRecords = input.canReadAllObjectRecords;
  role.canUpdateAllObjectRecords = input.canUpdateAllObjectRecords;
  role.canSoftDeleteAllObjectRecords = input.canSoftDeleteAllObjectRecords;
  role.canDestroyAllObjectRecords = input.canDestroyAllObjectRecords;
  role.canAccessAllTools = input.canAccessAllTools;
  await roleRepo().save(role);

  await record(workspaceId, actorUserId, 'role.updated', { roleId: role.id });
  return toDetail(role);
}

export async function deleteRole(workspaceId: string, roleId: string, actorUserId: string): Promise<void> {
  const role = await roleRepo().findOneBy({ id: roleId, workspaceId });
  if (!role) throw new NotFoundError('Role not found');
  if (!role.isEditable) throw new ForbiddenError('This role cannot be deleted');

  const workspace = await workspaceRepo().findOneByOrFail({ id: workspaceId });
  if (workspace.defaultRoleId === roleId) {
    throw new ConflictError('Choose a different default role before deleting this one');
  }

  // Rebind affected members to the workspace's default role before deleting.
  if (workspace.defaultRoleId) {
    await memberRepo().update({ workspaceId, roleId }, { roleId: workspace.defaultRoleId });
  }

  await flagRepo().delete({ roleId });
  await objectPermissionRepo().delete({ roleId });
  await fieldPermissionRepo().delete({ roleId });
  await rowLevelPermissionRepo().delete({ roleId });
  await roleRepo().delete({ id: roleId });

  await record(workspaceId, actorUserId, 'role.deleted', { roleId, name: role.name });
}

// ---- Settings permission flags ----

export async function getSettingsPermissions(workspaceId: string, roleId: string): Promise<string[]> {
  const role = await roleRepo().findOneBy({ id: roleId, workspaceId });
  if (!role) throw new NotFoundError('Role not found');
  const flags = await flagRepo().findBy({ roleId });
  return flags.map((f) => f.flag);
}

export async function updateSettingsPermissions(
  workspaceId: string,
  roleId: string,
  actorUserId: string,
  input: UpdateSettingsPermissionsRequest,
): Promise<void> {
  const role = await roleRepo().findOneBy({ id: roleId, workspaceId });
  if (!role) throw new NotFoundError('Role not found');

  await dataSource.transaction(async (manager) => {
    await manager.delete(RolePermissionFlagEntity, { roleId });
    if (input.flags.length > 0) {
      await manager.save(
        RolePermissionFlagEntity,
        input.flags.map((flag) => manager.create(RolePermissionFlagEntity, { roleId, flag })),
      );
    }
  });

  await record(workspaceId, actorUserId, 'role.permissions_updated', { roleId, flags: input.flags });
}

// ---- Object-level permissions ----
//
// Each of the four booleans is tri-state (null = inherit the
// role's blanket `canXAllObjectRecords` flag; true/false = an explicit per-object override).
// `hasOverride` is true once any of the four is non-null.

export interface ObjectPermissionSummary {
  objectMetadataId: string;
  objectLabel: string;
  icon: string;
  isCustom: boolean;
  hasOverride: boolean;
  canRead: boolean | null;
  canUpdate: boolean | null;
  canSoftDelete: boolean | null;
  canDestroy: boolean | null;
}

/**
 * Objects a role can be granted permission on.
 * `isSystem` here just marks a standard, seeded-at-workspace-creation object (Company, Person, ...),
 * not an internal/hidden one — those are still assignable, so only `isActive` gates the list.
 */
async function listPermissionableObjects(workspaceId: string): Promise<ObjectMetadataEntity[]> {
  return dataSource.getRepository(ObjectMetadataEntity).findBy({ workspaceId, isActive: true });
}

export async function listObjectPermissions(
  workspaceId: string,
  roleId: string,
): Promise<ObjectPermissionSummary[]> {
  const role = await roleRepo().findOneBy({ id: roleId, workspaceId });
  if (!role) throw new NotFoundError('Role not found');

  const [objects, overrides] = await Promise.all([
    listPermissionableObjects(workspaceId),
    objectPermissionRepo().findBy({ roleId }),
  ]);
  const overrideByObjectId = new Map(overrides.map((o) => [o.objectMetadataId, o]));

  return objects.map((object) => {
    const override = overrideByObjectId.get(object.id);
    return {
      objectMetadataId: object.id,
      objectLabel: object.labelPlural,
      icon: object.icon ?? 'Circle',
      isCustom: object.isCustom,
      hasOverride: override !== undefined,
      canRead: override?.canRead ?? null,
      canUpdate: override?.canUpdate ?? null,
      canSoftDelete: override?.canSoftDelete ?? null,
      canDestroy: override?.canDestroy ?? null,
    };
  });
}

export async function removeObjectPermission(
  workspaceId: string,
  roleId: string,
  objectMetadataId: string,
  actorUserId: string,
): Promise<void> {
  const role = await roleRepo().findOneBy({ id: roleId, workspaceId });
  if (!role) throw new NotFoundError('Role not found');

  await objectPermissionRepo().delete({ roleId, objectMetadataId });
  await fieldPermissionRepo().delete({
    roleId,
    fieldMetadataId: In(
      (await dataSource.getRepository(FieldMetadataEntity).findBy({ workspaceId, objectMetadataId })).map(
        (f) => f.id,
      ),
    ),
  });
  await rowLevelPermissionRepo().delete({ roleId, objectMetadataId });
  await record(workspaceId, actorUserId, 'role.permissions_updated', { roleId, objectMetadataId, removed: true });
}

export async function updateObjectPermission(
  workspaceId: string,
  roleId: string,
  objectMetadataId: string,
  actorUserId: string,
  input: UpdateObjectPermissionRequest,
): Promise<void> {
  const [role, object] = await Promise.all([
    roleRepo().findOneBy({ id: roleId, workspaceId }),
    dataSource.getRepository(ObjectMetadataEntity).findOneBy({ id: objectMetadataId, workspaceId }),
  ]);
  if (!role) throw new NotFoundError('Role not found');
  if (!object) throw new NotFoundError('Object not found');

  let permission = await objectPermissionRepo().findOneBy({ roleId, objectMetadataId });
  const merged = {
    canRead: input.canRead !== undefined ? input.canRead : (permission?.canRead ?? null),
    canUpdate: input.canUpdate !== undefined ? input.canUpdate : (permission?.canUpdate ?? null),
    canSoftDelete: input.canSoftDelete !== undefined ? input.canSoftDelete : (permission?.canSoftDelete ?? null),
    canDestroy: input.canDestroy !== undefined ? input.canDestroy : (permission?.canDestroy ?? null),
  };

  const resolvedRead = merged.canRead ?? role.canReadAllObjectRecords;
  const resolvedUpdate = merged.canUpdate ?? role.canUpdateAllObjectRecords;
  const resolvedSoftDelete = merged.canSoftDelete ?? role.canSoftDeleteAllObjectRecords;
  const resolvedDestroy = merged.canDestroy ?? role.canDestroyAllObjectRecords;
  if (!resolvedRead && (resolvedUpdate || resolvedSoftDelete || resolvedDestroy)) {
    throw new ConflictError('Cannot grant write access to an object this role cannot read');
  }

  const isAllNull = Object.values(merged).every((v) => v === null);
  if (isAllNull) {
    if (permission) await objectPermissionRepo().delete({ roleId, objectMetadataId });
  } else {
    if (!permission) permission = objectPermissionRepo().create({ roleId, objectMetadataId });
    Object.assign(permission, merged);
    await objectPermissionRepo().save(permission);
  }

  await record(workspaceId, actorUserId, 'role.permissions_updated', { roleId, objectMetadataId });
}

// ---- Field-level permissions ----
//
// Pure restrictions layered on top of resolved object-level access: `canRead`/`canUpdate` are
// only ever `false` (restricted) or `null` (not restricted) — there's no explicit `true` grant.
// Restricting read cascades into restricting update too, since an unreadable field can't be edited.

/** Fallback icon by field type, used whenever a field has no explicit `icon` set. */
const FIELD_TYPE_ICON: Record<string, string> = {
  [FieldMetadataType.TEXT]: 'CaseSensitive',
  [FieldMetadataType.NUMBER]: 'Hash',
  [FieldMetadataType.BOOLEAN]: 'ToggleLeft',
  [FieldMetadataType.DATE_TIME]: 'CalendarClock',
  [FieldMetadataType.DATE]: 'Calendar',
  [FieldMetadataType.SELECT]: 'Tag',
  [FieldMetadataType.MULTI_SELECT]: 'Tags',
  [FieldMetadataType.RATING]: 'Star',
  [FieldMetadataType.FILES]: 'Paperclip',
  [FieldMetadataType.CURRENCY]: 'DollarSign',
  [FieldMetadataType.EMAILS]: 'Mail',
  [FieldMetadataType.LINKS]: 'Link',
  [FieldMetadataType.PHONES]: 'Phone',
  [FieldMetadataType.FULL_NAME]: 'User',
  [FieldMetadataType.ADDRESS]: 'MapPin',
  [FieldMetadataType.RICH_TEXT]: 'AlignLeft',
  [FieldMetadataType.RELATION]: 'ArrowLeftRight',
  [FieldMetadataType.MORPH_RELATION]: 'ArrowLeftRight',
  [FieldMetadataType.RAW_JSON]: 'Braces',
  [FieldMetadataType.ARRAY]: 'List',
  [FieldMetadataType.UUID]: 'Fingerprint',
};

export interface FieldPermissionSummary {
  fieldMetadataId: string;
  fieldLabel: string;
  fieldType: string;
  icon: string;
  isRestrictable: boolean;
  canRead: boolean | null;
  canUpdate: boolean | null;
}

export async function listFieldPermissions(
  workspaceId: string,
  roleId: string,
  objectMetadataId: string,
): Promise<FieldPermissionSummary[]> {
  const [role, object] = await Promise.all([
    roleRepo().findOneBy({ id: roleId, workspaceId }),
    dataSource.getRepository(ObjectMetadataEntity).findOneBy({ id: objectMetadataId, workspaceId }),
  ]);
  if (!role) throw new NotFoundError('Role not found');
  if (!object) throw new NotFoundError('Object not found');

  const fields = await dataSource
    .getRepository(FieldMetadataEntity)
    .findBy({ workspaceId, objectMetadataId, isActive: true });
  const overrides = await fieldPermissionRepo().findBy({
    roleId,
    fieldMetadataId: In(fields.length > 0 ? fields.map((f) => f.id) : ['00000000-0000-0000-0000-000000000000']),
  });
  const overrideByFieldId = new Map(overrides.map((o) => [o.fieldMetadataId, o]));

  return fields.map((field) => {
    const override = overrideByFieldId.get(field.id);
    return {
      fieldMetadataId: field.id,
      fieldLabel: field.label,
      fieldType: field.type,
      icon: field.icon ?? FIELD_TYPE_ICON[field.type] ?? 'Circle',
      isRestrictable: field.isRestrictable,
      canRead: field.isRestrictable ? (override?.canRead ?? null) : null,
      canUpdate: field.isRestrictable ? (override?.canUpdate ?? null) : null,
    };
  });
}

export async function updateFieldPermission(
  workspaceId: string,
  roleId: string,
  fieldMetadataId: string,
  actorUserId: string,
  input: UpdateFieldPermissionRequest,
): Promise<void> {
  const [role, field] = await Promise.all([
    roleRepo().findOneBy({ id: roleId, workspaceId }),
    dataSource.getRepository(FieldMetadataEntity).findOneBy({ id: fieldMetadataId, workspaceId }),
  ]);
  if (!role) throw new NotFoundError('Role not found');
  if (!field) throw new NotFoundError('Field not found');
  if (!field.isRestrictable) throw new ConflictError('This field cannot be permission-restricted');

  let permission = await fieldPermissionRepo().findOneBy({ roleId, fieldMetadataId });
  const canRead = input.canRead !== undefined ? input.canRead : (permission?.canRead ?? null);
  // Restricting read implies restricting update too — an unreadable field can't stay editable.
  const canUpdate =
    canRead === false ? false : input.canUpdate !== undefined ? input.canUpdate : (permission?.canUpdate ?? null);

  if (canRead === null && canUpdate === null) {
    if (permission) await fieldPermissionRepo().delete({ roleId, fieldMetadataId });
  } else {
    if (!permission) permission = fieldPermissionRepo().create({ roleId, fieldMetadataId });
    permission.canRead = canRead;
    permission.canUpdate = canUpdate;
    await fieldPermissionRepo().save(permission);
  }

  await record(workspaceId, actorUserId, 'role.permissions_updated', { roleId, fieldMetadataId });
}

// ---- Row-level permissions ----
//
// A single, flat, ordered list of conditions per role+object combined with each condition's own
// AND/OR (no nested groups) — applies uniformly to read/update/delete and to both workspace
// members and API keys (no per-operation split, no agent/AI applicability). Replaced as a whole
// on every save; see apps/api/src/modules/record/row-level-permission.ts for enforcement.

export interface RowLevelPermissionConditionSummary {
  fieldMetadataId: string;
  fieldLabel: string;
  operand: string;
  valueMode: string;
  value: unknown;
  logicalOperator: string;
}

export async function listRowLevelPermissions(
  workspaceId: string,
  roleId: string,
  objectMetadataId: string,
): Promise<RowLevelPermissionConditionSummary[]> {
  const [role, object] = await Promise.all([
    roleRepo().findOneBy({ id: roleId, workspaceId }),
    dataSource.getRepository(ObjectMetadataEntity).findOneBy({ id: objectMetadataId, workspaceId }),
  ]);
  if (!role) throw new NotFoundError('Role not found');
  if (!object) throw new NotFoundError('Object not found');

  const [rules, fields] = await Promise.all([
    rowLevelPermissionRepo().find({ where: { roleId, objectMetadataId }, order: { position: 'ASC' } }),
    dataSource.getRepository(FieldMetadataEntity).findBy({ workspaceId, objectMetadataId, isActive: true }),
  ]);
  const labelByFieldId = new Map(fields.map((f) => [f.id, f.label]));

  return rules.map((rule) => ({
    fieldMetadataId: rule.fieldMetadataId,
    fieldLabel: labelByFieldId.get(rule.fieldMetadataId) ?? 'Unknown field',
    operand: rule.operand,
    valueMode: rule.valueMode,
    value: rule.value,
    logicalOperator: rule.logicalOperator,
  }));
}

export async function replaceRowLevelPermissions(
  workspaceId: string,
  roleId: string,
  objectMetadataId: string,
  actorUserId: string,
  input: ReplaceRowLevelPermissionsRequest,
): Promise<void> {
  const [role, object] = await Promise.all([
    roleRepo().findOneBy({ id: roleId, workspaceId }),
    dataSource.getRepository(ObjectMetadataEntity).findOneBy({ id: objectMetadataId, workspaceId }),
  ]);
  if (!role) throw new NotFoundError('Role not found');
  if (!object) throw new NotFoundError('Object not found');

  const fields = await dataSource
    .getRepository(FieldMetadataEntity)
    .findBy({ workspaceId, objectMetadataId, isActive: true });
  const filterable = buildFilterableFieldIndex(fields);
  const filterableFieldIds = new Set([...filterable.values()].map((f) => f.field.id));

  for (const condition of input.conditions) {
    if (!filterableFieldIds.has(condition.fieldMetadataId)) {
      throw new ConflictError('One or more conditions reference a field that cannot be used in a row-level rule');
    }
    if (condition.valueMode === RowLevelPermissionValueMode.CURRENT_USER) {
      const isEqualityOperand =
        condition.operand === ViewFilterOperand.IS || condition.operand === ViewFilterOperand.IS_NOT;
      if (!isEqualityOperand) {
        throw new ConflictError('"Current user" conditions only support the "is"/"is not" operators');
      }
    }
  }

  await dataSource.transaction(async (manager) => {
    await manager.delete(RowLevelPermissionEntity, { roleId, objectMetadataId });
    if (input.conditions.length > 0) {
      await manager.save(
        RowLevelPermissionEntity,
        input.conditions.map((condition, position) =>
          manager.create(RowLevelPermissionEntity, {
            roleId,
            objectMetadataId,
            fieldMetadataId: condition.fieldMetadataId,
            operand: condition.operand as ViewFilterOperand,
            valueMode: condition.valueMode as RowLevelPermissionValueMode,
            value: condition.valueMode === RowLevelPermissionValueMode.CURRENT_USER ? null : (condition.value ?? null),
            logicalOperator: (position === 0 ? 'AND' : condition.logicalOperator) as LogicalOperator,
            position,
          }),
        ),
      );
    }
  });

  await record(workspaceId, actorUserId, 'role.permissions_updated', {
    roleId,
    objectMetadataId,
    rowLevelPermission: true,
  });
}

// ---- Assignment ----

export interface RoleMemberSummary {
  id: string;
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
}

export async function listRoleMembers(workspaceId: string, roleId: string): Promise<RoleMemberSummary[]> {
  const role = await roleRepo().findOneBy({ id: roleId, workspaceId });
  if (!role) throw new NotFoundError('Role not found');

  const members = await memberRepo().findBy({ workspaceId, roleId });
  if (members.length === 0) return [];

  const users = await dataSource.getRepository(UserEntity).findBy({ id: In(members.map((m) => m.userId)) });
  const emailByUserId = new Map(users.map((u) => [u.id, u.email]));

  return members.map((member) => ({
    id: member.id,
    userId: member.userId,
    email: emailByUserId.get(member.userId) ?? '',
    firstName: member.firstName,
    lastName: member.lastName,
  }));
}
