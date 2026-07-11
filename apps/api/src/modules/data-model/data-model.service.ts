import {
  createMetadataService,
  FieldMetadataEntity,
  IndexMetadataEntity,
  mapFieldToColumns,
  ObjectMetadataEntity,
  WorkspaceEntity,
} from '@saasly/database';
import type {
  CreateFieldRequest,
  CreateIndexRequest,
  CreateMorphRelationRequest,
  CreateObjectRequest,
  CreateRelationRequest,
  SetObjectIdentifiersRequest,
  UpdateFieldRequest,
  UpdateObjectRequest,
} from '@saasly/shared';
import { dataSource } from '../../lib/db.js';
import { ConflictError, ForbiddenError, NotFoundError } from '../../lib/errors.js';
import { record } from '../audit-log/audit-log.service.js';

const objectRepo = () => dataSource.getRepository(ObjectMetadataEntity);
const fieldRepo = () => dataSource.getRepository(FieldMetadataEntity);
const indexRepo = () => dataSource.getRepository(IndexMetadataEntity);
const metadataService = createMetadataService(dataSource);

/** The primary physical column backing a field (first column of its mapping), used for indexes. */
function primaryColumnName(field: FieldMetadataEntity): string {
  const mapped = mapFieldToColumns(
    { name: field.name, type: field.type, isNullable: field.isNullable, isUnique: field.isUnique, settings: field.settings },
    'placeholder',
    'placeholder',
  );
  return mapped.columns[0]?.name ?? field.name;
}

async function requireWorkspace(workspaceId: string): Promise<WorkspaceEntity> {
  const workspace = await dataSource.getRepository(WorkspaceEntity).findOneByOrFail({ id: workspaceId });
  if (!workspace.databaseSchema) throw new ConflictError('Workspace is not provisioned yet');
  return workspace;
}

/** snake_case identifier from a label, e.g. "Delivery Zone" -> "delivery_zone", "_2" if taken. */
async function generateUniqueName(
  workspaceId: string,
  label: string,
  exists: (workspaceId: string, candidate: string) => Promise<boolean>,
): Promise<string> {
  const base = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'field';

  for (let suffix = 1; ; suffix += 1) {
    const candidate = suffix === 1 ? base : `${base}_${suffix}`;
    if (!(await exists(workspaceId, candidate))) return candidate;
  }
}

// ---- Objects ----

export interface ObjectSummary {
  id: string;
  nameSingular: string;
  namePlural: string;
  labelSingular: string;
  labelPlural: string;
  icon: string;
  description: string | null;
  isCustom: boolean;
  isSystem: boolean;
  isActive: boolean;
  labelIdentifierFieldMetadataId: string | null;
  imageIdentifierFieldMetadataId: string | null;
  fieldCount: number;
}

export interface FieldSummary {
  id: string;
  name: string;
  label: string;
  type: string;
  icon: string;
  description: string | null;
  isCustom: boolean;
  isSystem: boolean;
  isActive: boolean;
  isNullable: boolean;
  isUnique: boolean;
  isRestrictable: boolean;
  isVisibleInRecordPage: boolean;
  settings: Record<string, unknown> | null;
  defaultValue: unknown;
}

export interface IndexSummary {
  id: string;
  name: string;
  isUnique: boolean;
  columnNames: string[];
}

function toObjectSummary(object: ObjectMetadataEntity, fieldCount: number): ObjectSummary {
  return {
    id: object.id,
    nameSingular: object.nameSingular,
    namePlural: object.namePlural,
    labelSingular: object.labelSingular,
    labelPlural: object.labelPlural,
    icon: object.icon ?? 'Circle',
    description: object.description,
    isCustom: object.isCustom,
    isSystem: object.isSystem,
    isActive: object.isActive,
    labelIdentifierFieldMetadataId: object.labelIdentifierFieldMetadataId,
    imageIdentifierFieldMetadataId: object.imageIdentifierFieldMetadataId,
    fieldCount,
  };
}

function toFieldSummary(field: FieldMetadataEntity): FieldSummary {
  return {
    id: field.id,
    name: field.name,
    label: field.label,
    type: field.type,
    icon: field.icon ?? 'Circle',
    description: field.description,
    isCustom: field.isCustom,
    isSystem: field.isSystem,
    isActive: field.isActive,
    isNullable: field.isNullable,
    isUnique: field.isUnique,
    isRestrictable: field.isRestrictable,
    isVisibleInRecordPage: field.isVisibleInRecordPage,
    settings: (field.settings as Record<string, unknown> | null) ?? null,
    defaultValue: field.defaultValue ?? null,
  };
}

function toIndexSummary(index: IndexMetadataEntity): IndexSummary {
  return { id: index.id, name: index.name, isUnique: index.isUnique, columnNames: index.columnNames };
}

export async function listObjects(workspaceId: string): Promise<ObjectSummary[]> {
  const objects = await objectRepo().findBy({ workspaceId });
  const fields = await fieldRepo().findBy({ workspaceId });
  const countByObject = new Map<string, number>();
  for (const field of fields) countByObject.set(field.objectMetadataId, (countByObject.get(field.objectMetadataId) ?? 0) + 1);
  return objects.map((o) => toObjectSummary(o, countByObject.get(o.id) ?? 0));
}

export async function getObject(
  workspaceId: string,
  objectMetadataId: string,
): Promise<{ object: ObjectSummary; fields: FieldSummary[]; indexes: IndexSummary[] }> {
  const object = await objectRepo().findOneBy({ id: objectMetadataId, workspaceId });
  if (!object) throw new NotFoundError('Object not found');
  const [fields, indexes] = await Promise.all([
    fieldRepo().findBy({ objectMetadataId, workspaceId }),
    indexRepo().findBy({ objectMetadataId, workspaceId }),
  ]);
  return {
    object: toObjectSummary(object, fields.length),
    fields: fields.map(toFieldSummary),
    indexes: indexes.map(toIndexSummary),
  };
}

export async function createObject(
  workspaceId: string,
  actorUserId: string,
  input: CreateObjectRequest,
): Promise<ObjectSummary> {
  const workspace = await requireWorkspace(workspaceId);

  const existingLabel = await objectRepo().findOneBy({ workspaceId, labelSingular: input.label });
  if (existingLabel) throw new ConflictError('An object with this label already exists');

  const nameSingular = await generateUniqueName(
    workspaceId,
    input.label,
    (wsId, candidate) => objectRepo().existsBy({ workspaceId: wsId, nameSingular: candidate }),
  );
  const namePlural = await generateUniqueName(
    workspaceId,
    input.labelPlural,
    (wsId, candidate) => objectRepo().existsBy({ workspaceId: wsId, namePlural: candidate }),
  );

  const object = await metadataService.createObject({
    workspaceId,
    schemaName: workspace.databaseSchema!,
    nameSingular,
    namePlural,
    labelSingular: input.label,
    labelPlural: input.labelPlural,
    icon: input.icon ?? 'Circle',
    description: input.description ?? undefined,
    isCustom: true,
    isSystem: false,
  });

  // Seed the standard starter fields (Name + system/audit fields), matching Twenty.
  await metadataService.seedNewObjectDefaults({
    workspaceId,
    schemaName: workspace.databaseSchema!,
    objectMetadataId: object.id,
    tableName: object.namePlural,
  });

  await record(workspaceId, actorUserId, 'data_model.object_created', { objectMetadataId: object.id, name: object.nameSingular });
  const refreshed = await objectRepo().findOneByOrFail({ id: object.id });
  const fieldCount = await fieldRepo().count({ where: { objectMetadataId: object.id } });
  return toObjectSummary(refreshed, fieldCount);
}

export async function updateObject(
  workspaceId: string,
  objectMetadataId: string,
  actorUserId: string,
  input: UpdateObjectRequest,
): Promise<ObjectSummary> {
  const object = await objectRepo().findOneBy({ id: objectMetadataId, workspaceId });
  if (!object) throw new NotFoundError('Object not found');

  const updated = await metadataService.updateObject({
    workspaceId,
    objectMetadataId,
    labelSingular: input.label,
    labelPlural: input.labelPlural,
    icon: input.icon,
    description: input.description ?? undefined,
  });

  await record(workspaceId, actorUserId, 'data_model.object_updated', { objectMetadataId });
  const fieldCount = await fieldRepo().count({ where: { objectMetadataId } });
  return toObjectSummary(updated, fieldCount);
}

export async function setObjectActive(
  workspaceId: string,
  objectMetadataId: string,
  actorUserId: string,
  isActive: boolean,
): Promise<void> {
  const object = await objectRepo().findOneBy({ id: objectMetadataId, workspaceId });
  if (!object) throw new NotFoundError('Object not found');
  if (!object.isCustom) throw new ForbiddenError('Standard objects cannot be deactivated');

  await metadataService.setObjectActive(workspaceId, objectMetadataId, isActive);
  await record(workspaceId, actorUserId, 'data_model.object_updated', { objectMetadataId, isActive });
}

export async function deleteObject(workspaceId: string, objectMetadataId: string, actorUserId: string): Promise<void> {
  const [workspace, object] = await Promise.all([
    requireWorkspace(workspaceId),
    objectRepo().findOneBy({ id: objectMetadataId, workspaceId }),
  ]);
  if (!object) throw new NotFoundError('Object not found');
  if (!object.isCustom) throw new ForbiddenError('Standard objects cannot be deleted');
  if (object.isActive) throw new ConflictError('Deactivate this object before deleting it');

  await metadataService.deleteObject({
    workspaceId,
    schemaName: workspace.databaseSchema!,
    objectMetadataId,
    tableName: object.namePlural,
  });

  await record(workspaceId, actorUserId, 'data_model.object_deleted', { objectMetadataId, name: object.nameSingular });
}

// ---- Fields ----

export async function createField(
  workspaceId: string,
  objectMetadataId: string,
  actorUserId: string,
  input: CreateFieldRequest,
): Promise<FieldSummary> {
  const [workspace, object] = await Promise.all([
    requireWorkspace(workspaceId),
    objectRepo().findOneBy({ id: objectMetadataId, workspaceId }),
  ]);
  if (!object) throw new NotFoundError('Object not found');

  const existingLabel = await fieldRepo().findOneBy({ workspaceId, objectMetadataId, label: input.label });
  if (existingLabel) throw new ConflictError('A field with this label already exists on this object');

  const name = await generateUniqueName(workspaceId, input.label, (wsId, candidate) =>
    fieldRepo().existsBy({ workspaceId: wsId, objectMetadataId, name: candidate }),
  );

  const field = await metadataService.createField({
    workspaceId,
    schemaName: workspace.databaseSchema!,
    objectMetadataId,
    tableName: object.namePlural,
    name,
    label: input.label,
    type: input.type,
    description: input.description ?? undefined,
    icon: input.icon,
    isNullable: input.isNullable,
    isUnique: input.isUnique,
    settings: input.settings,
    defaultValue: input.defaultValue,
    isCustom: true,
    isSystem: false,
  });

  await record(workspaceId, actorUserId, 'data_model.field_created', { objectMetadataId, fieldMetadataId: field.id, name: field.name });
  return toFieldSummary(field);
}

export async function updateField(
  workspaceId: string,
  fieldMetadataId: string,
  actorUserId: string,
  input: UpdateFieldRequest,
): Promise<FieldSummary> {
  const field = await fieldRepo().findOneBy({ id: fieldMetadataId, workspaceId });
  if (!field) throw new NotFoundError('Field not found');
  const object = await objectRepo().findOneByOrFail({ id: field.objectMetadataId, workspaceId });
  const workspace = await requireWorkspace(workspaceId);

  const updated = await metadataService.updateField({
    workspaceId,
    schemaName: workspace.databaseSchema!,
    tableName: object.namePlural,
    fieldMetadataId,
    label: input.label,
    icon: input.icon,
    description: input.description ?? undefined,
    settings: input.settings,
    defaultValue: input.defaultValue,
  });

  await record(workspaceId, actorUserId, 'data_model.field_updated', { fieldMetadataId });
  return toFieldSummary(updated);
}

/** Core fields that can never be deactivated (mirrors Twenty's fieldNamesThatCannotBeDeactivated). */
const NON_DEACTIVATABLE_FIELD_NAMES = new Set(['created_at', 'updated_at', 'deleted_at', 'created_by']);

export async function setFieldActive(
  workspaceId: string,
  fieldMetadataId: string,
  actorUserId: string,
  isActive: boolean,
): Promise<void> {
  const field = await fieldRepo().findOneBy({ id: fieldMetadataId, workspaceId });
  if (!field) throw new NotFoundError('Field not found');
  if (!isActive) {
    const object = await objectRepo().findOneByOrFail({ id: field.objectMetadataId, workspaceId });
    if (object.labelIdentifierFieldMetadataId === fieldMetadataId) {
      throw new ConflictError('This field is the record label and cannot be deactivated');
    }
    if (NON_DEACTIVATABLE_FIELD_NAMES.has(field.name)) {
      throw new ConflictError('This system field cannot be deactivated');
    }
  }

  await metadataService.setFieldActive(workspaceId, fieldMetadataId, isActive);
  await record(workspaceId, actorUserId, 'data_model.field_updated', { fieldMetadataId, isActive });
}

/**
 * Settings → Layout (BRD §7.2): hides a field from a record's Overview tab without deactivating it
 * or touching the physical schema — no DDL, no metadata-version bump, just a display flag.
 */
export async function setFieldRecordPageVisibility(
  workspaceId: string,
  fieldMetadataId: string,
  actorUserId: string,
  isVisible: boolean,
): Promise<FieldSummary> {
  const field = await fieldRepo().findOneBy({ id: fieldMetadataId, workspaceId });
  if (!field) throw new NotFoundError('Field not found');

  field.isVisibleInRecordPage = isVisible;
  await fieldRepo().save(field);
  await record(workspaceId, actorUserId, 'data_model.field_updated', { fieldMetadataId, isVisibleInRecordPage: isVisible });
  return toFieldSummary(field);
}

export async function deleteField(workspaceId: string, fieldMetadataId: string, actorUserId: string): Promise<void> {
  const [workspace, field] = await Promise.all([
    requireWorkspace(workspaceId),
    fieldRepo().findOneBy({ id: fieldMetadataId, workspaceId }),
  ]);
  if (!field) throw new NotFoundError('Field not found');
  if (!field.isCustom) throw new ForbiddenError('Standard fields cannot be deleted');

  const object = await objectRepo().findOneByOrFail({ id: field.objectMetadataId, workspaceId });
  if (object.labelIdentifierFieldMetadataId === fieldMetadataId) {
    throw new ConflictError('This field is the record label; pick another record label before deleting it');
  }

  await metadataService.deleteField({
    workspaceId,
    schemaName: workspace.databaseSchema!,
    tableName: object.namePlural,
    fieldMetadataId,
  });

  await record(workspaceId, actorUserId, 'data_model.field_deleted', { fieldMetadataId, name: field.name });
}

// ---- Relations ----

export async function createRelation(
  workspaceId: string,
  sourceObjectMetadataId: string,
  actorUserId: string,
  input: CreateRelationRequest,
): Promise<{ forward: FieldSummary; reverse: FieldSummary }> {
  const [workspace, source, target] = await Promise.all([
    requireWorkspace(workspaceId),
    objectRepo().findOneBy({ id: sourceObjectMetadataId, workspaceId }),
    objectRepo().findOneBy({ id: input.targetObjectMetadataId, workspaceId }),
  ]);
  if (!source) throw new NotFoundError('Object not found');
  if (!target) throw new NotFoundError('Target object not found');

  const forwardName = await generateUniqueName(workspaceId, input.forwardLabel, (wsId, candidate) =>
    fieldRepo().existsBy({ workspaceId: wsId, objectMetadataId: sourceObjectMetadataId, name: candidate }),
  );
  const reverseName = await generateUniqueName(workspaceId, input.reverseLabel, (wsId, candidate) =>
    fieldRepo().existsBy({ workspaceId: wsId, objectMetadataId: input.targetObjectMetadataId, name: candidate }),
  );

  const { forward, reverse } = await metadataService.createRelation({
    workspaceId,
    schemaName: workspace.databaseSchema!,
    sourceObjectMetadataId,
    sourceTableName: source.namePlural,
    forwardName,
    forwardLabel: input.forwardLabel,
    forwardIcon: input.forwardIcon,
    targetObjectMetadataId: input.targetObjectMetadataId,
    targetTableName: target.namePlural,
    reverseName,
    reverseLabel: input.reverseLabel,
    reverseIcon: input.reverseIcon,
    onDelete: input.onDelete,
    isNullable: input.isNullable,
    relationType: input.relationType,
  });

  await record(workspaceId, actorUserId, 'data_model.relation_created', {
    sourceObjectMetadataId,
    targetObjectMetadataId: input.targetObjectMetadataId,
  });
  return { forward: toFieldSummary(forward), reverse: toFieldSummary(reverse) };
}

export async function createMorphRelation(
  workspaceId: string,
  sourceObjectMetadataId: string,
  actorUserId: string,
  input: CreateMorphRelationRequest,
): Promise<{ forward: FieldSummary; reverses: FieldSummary[] }> {
  const workspace = await requireWorkspace(workspaceId);
  const source = await objectRepo().findOneBy({ id: sourceObjectMetadataId, workspaceId });
  if (!source) throw new NotFoundError('Object not found');

  const targets = await objectRepo().findBy({ workspaceId });
  const targetIds = new Set(targets.map((t) => t.id));
  for (const id of input.targetObjectMetadataIds) {
    if (!targetIds.has(id)) throw new NotFoundError('Target object not found');
  }

  const forwardName = await generateUniqueName(workspaceId, input.forwardLabel, (wsId, candidate) =>
    fieldRepo().existsBy({ workspaceId: wsId, objectMetadataId: sourceObjectMetadataId, name: candidate }),
  );
  // A single reverse name is reused across every target object (unique within each object's own scope).
  const reverseName = input.reverseLabel
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'related';

  const { forward, reverses } = await metadataService.createMorphRelation({
    workspaceId,
    schemaName: workspace.databaseSchema!,
    sourceObjectMetadataId,
    sourceTableName: source.namePlural,
    forwardName,
    forwardLabel: input.forwardLabel,
    forwardIcon: input.forwardIcon,
    targetObjectMetadataIds: input.targetObjectMetadataIds,
    reverseName,
    reverseLabel: input.reverseLabel,
    reverseIcon: input.reverseIcon,
    onDelete: input.onDelete,
    isNullable: input.isNullable,
  });

  await record(workspaceId, actorUserId, 'data_model.relation_created', {
    sourceObjectMetadataId,
    morphTargetObjectMetadataIds: input.targetObjectMetadataIds,
  });
  return { forward: toFieldSummary(forward), reverses: reverses.map(toFieldSummary) };
}

// ---- Object identifiers (record label / record image) ----

export async function setObjectIdentifiers(
  workspaceId: string,
  objectMetadataId: string,
  actorUserId: string,
  input: SetObjectIdentifiersRequest,
): Promise<ObjectSummary> {
  const object = await objectRepo().findOneBy({ id: objectMetadataId, workspaceId });
  if (!object) throw new NotFoundError('Object not found');

  for (const id of [input.labelIdentifierFieldMetadataId, input.imageIdentifierFieldMetadataId]) {
    if (id && !(await fieldRepo().existsBy({ id, objectMetadataId, workspaceId }))) {
      throw new NotFoundError('Identifier field not found on this object');
    }
  }

  const updated = await metadataService.setObjectIdentifiers(
    workspaceId,
    objectMetadataId,
    input.labelIdentifierFieldMetadataId,
    input.imageIdentifierFieldMetadataId,
  );
  await record(workspaceId, actorUserId, 'data_model.object_updated', { objectMetadataId, identifiers: true });
  const fieldCount = await fieldRepo().count({ where: { objectMetadataId } });
  return toObjectSummary(updated, fieldCount);
}

// ---- Indexes ----

export async function createIndex(
  workspaceId: string,
  objectMetadataId: string,
  actorUserId: string,
  input: CreateIndexRequest,
): Promise<IndexSummary> {
  const [workspace, object] = await Promise.all([
    requireWorkspace(workspaceId),
    objectRepo().findOneBy({ id: objectMetadataId, workspaceId }),
  ]);
  if (!object) throw new NotFoundError('Object not found');

  const fields = await fieldRepo().findBy({ workspaceId, objectMetadataId });
  const byId = new Map(fields.map((f) => [f.id, f]));
  const columnNames: string[] = [];
  for (const fieldId of input.fieldMetadataIds) {
    const field = byId.get(fieldId);
    if (!field) throw new NotFoundError('Index field not found on this object');
    columnNames.push(primaryColumnName(field));
  }

  const suffix = input.isUnique ? 'unq' : 'idx';
  const name = `${object.namePlural}_${columnNames.join('_')}_${suffix}`.slice(0, 63);

  const index = await metadataService.createIndex({
    workspaceId,
    schemaName: workspace.databaseSchema!,
    objectMetadataId,
    tableName: object.namePlural,
    name,
    columnNames,
    isUnique: input.isUnique,
    indexType: input.indexType,
  });

  await record(workspaceId, actorUserId, 'data_model.field_updated', { objectMetadataId, indexCreated: name });
  return toIndexSummary(index);
}

export async function deleteIndex(
  workspaceId: string,
  indexMetadataId: string,
  actorUserId: string,
): Promise<void> {
  const [workspace, index] = await Promise.all([
    requireWorkspace(workspaceId),
    indexRepo().findOneBy({ id: indexMetadataId, workspaceId }),
  ]);
  if (!index) throw new NotFoundError('Index not found');

  await metadataService.deleteIndex({ workspaceId, schemaName: workspace.databaseSchema!, indexMetadataId });
  await record(workspaceId, actorUserId, 'data_model.field_updated', { indexDeleted: index.name });
}
