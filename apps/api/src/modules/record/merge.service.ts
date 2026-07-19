import type { Repository } from 'typeorm';
import { FieldMetadataEntity, ObjectMetadataEntity } from '@saasly/database';
import { FieldMetadataType } from '@saasly/shared';
import { dataSource } from '../../lib/db.js';
import { workspaceDataSourceCache } from '../../lib/workspace-data-source.js';
import { AppError, NotFoundError } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
import { COMPOSITE_SHAPE, decodeRecord } from './record-field-codec.js';
import { applyRowLevelPermission } from './row-level-permission.js';
import { updateSearchVector } from './search-vector.js';
import { resolveActiveFields, resolveObject, getRepository } from './record.service.js';
import {
  assertObjectAccess,
  resolveActorRole,
  resolveFieldRestrictions,
  type ActorRole,
  type Principal,
} from './record-permission.js';

export interface MergeRecordsInput {
  targetRecordId: string;
  loserRecordIds: string[];
  /** fieldMetadataId -> which record's value the merged record should keep (defaults to the target's own). */
  fieldOverrides?: Record<string, string>;
}

/** All physical columns backing one field — the full set, unlike duplicate.service.ts's equality-only subset. */
function physicalColumns(field: Pick<FieldMetadataEntity, 'name' | 'type' | 'settings'>): string[] {
  if (field.type === FieldMetadataType.RELATION) {
    return field.settings?.relationType === 'ONE_TO_MANY' ? [] : [`${field.name}_id`];
  }
  if (field.type === FieldMetadataType.MORPH_RELATION) {
    return [`${field.name}_target_type`, `${field.name}_target_id`];
  }
  const shape = COMPOSITE_SHAPE[field.type];
  if (shape) return shape.map((sub) => `${field.name}_${sub.suffix}`);
  return [field.name];
}

/**
 * Bulk-reassigns every workspace-wide reference to `fromIds` (the records being merged away) over
 * to `toId`, across every other object's RELATION (forward, MANY_TO_ONE) and MORPH_RELATION
 * (forward) fields that can point at `targetObject`. One `UPDATE` per referencing field/table, not
 * per row. Mirrors Twenty's merge relation-migration, extended to also cover MORPH_RELATION, which
 * Twenty's own merge does not handle.
 */
async function reassignRelations(
  workspaceId: string,
  targetObject: ObjectMetadataEntity,
  fromIds: string[],
  toId: string,
): Promise<void> {
  const workspaceDs = await workspaceDataSourceCache.getWorkspaceDataSource(workspaceId);
  const [allFields, allObjects] = await Promise.all([
    dataSource.getRepository(FieldMetadataEntity).findBy({ workspaceId, isActive: true }),
    dataSource.getRepository(ObjectMetadataEntity).findBy({ workspaceId, isActive: true }),
  ]);
  const objectById = new Map(allObjects.map((o) => [o.id, o]));

  for (const field of allFields) {
    const owningObject = objectById.get(field.objectMetadataId);
    if (!owningObject) continue;
    const repo = workspaceDs.getRepository(owningObject.nameSingular);
    const schema = repo.metadata.schema;
    const table = repo.metadata.tableName;

    if (
      field.type === FieldMetadataType.RELATION &&
      field.settings?.relationType === 'MANY_TO_ONE' &&
      field.settings?.relationTargetObjectMetadataId === targetObject.id
    ) {
      await repo.manager.query(
        `UPDATE "${schema}"."${table}" SET "${field.name}_id" = $1 WHERE "${field.name}_id" = ANY($2)`,
        [toId, fromIds],
      );
      continue;
    }

    if (field.type === FieldMetadataType.MORPH_RELATION && !field.settings?.isMorphReverse) {
      await repo.manager.query(
        `UPDATE "${schema}"."${table}"
         SET "${field.name}_target_id" = $1
         WHERE "${field.name}_target_type" = $2 AND "${field.name}_target_id" = ANY($3)`,
        [toId, targetObject.nameSingular, fromIds],
      );
    }
  }
}

/**
 * Merges 2+ records of the same object into one: relations pointing at any of them are bulk
 * reassigned to `targetRecordId` (see `reassignRelations`), per-field `fieldOverrides` copy a
 * loser's value onto the target where the caller wants it (unspecified fields keep the target's
 * own value), then the losers are soft-deleted. Requires update access to the target and
 * soft-delete access to the losers — the same object/field/row-level permission model as every
 * other mutation, so a merge can't be used to bypass what the caller could already read/write/delete.
 */
export async function mergeRecords(
  workspaceId: string,
  principal: Principal,
  objectNamePlural: string,
  input: MergeRecordsInput,
): Promise<Record<string, unknown>> {
  if (input.loserRecordIds.length === 0) throw new AppError('At least one record to merge is required', 400);
  if (input.loserRecordIds.includes(input.targetRecordId)) {
    throw new AppError('The target record cannot also be one of the records merged away', 400);
  }

  const object = await resolveObject(workspaceId, objectNamePlural);
  const actor = await resolveActorRole(principal, workspaceId);
  await assertObjectAccess(actor, object.id, 'update');
  await assertObjectAccess(actor, object.id, 'softDelete');

  const fields = await resolveActiveFields(workspaceId, object.id);
  const fieldById = new Map(fields.map((f) => [f.id, f]));
  const { restrictedForWrite, restrictedForRead } = await resolveFieldRestrictions(
    actor,
    fields.map((f) => f.id),
  );

  const repository = await getRepository(workspaceId, object);
  const alias = object.nameSingular;
  const allIds = [input.targetRecordId, ...input.loserRecordIds];
  const qb = repository.createQueryBuilder(alias).where(`"${alias}"."id" = ANY(:ids)`, { ids: allIds });
  await applyRowLevelPermission(qb, alias, actor, object.id, fields);
  const rows = await qb.getMany();
  const rowById = new Map(rows.map((r) => [(r as { id: string }).id, r as Record<string, unknown>]));

  const target = rowById.get(input.targetRecordId);
  if (!target) throw new NotFoundError('Target record not found');
  const losers = input.loserRecordIds.map((id) => rowById.get(id));
  if (losers.some((r) => !r)) throw new NotFoundError('One or more records to merge were not found');

  const patch: Record<string, unknown> = {};
  for (const [fieldId, sourceRecordId] of Object.entries(input.fieldOverrides ?? {})) {
    const field = fieldById.get(fieldId);
    if (!field) continue;
    if (restrictedForWrite.has(fieldId)) throw new AppError(`Field "${field.label}" is restricted for your role`, 403);
    const sourceRow = sourceRecordId === input.targetRecordId ? target : rowById.get(sourceRecordId);
    if (!sourceRow) continue;
    for (const column of physicalColumns(field)) patch[column] = sourceRow[column];
  }

  if (Object.keys(patch).length > 0) {
    Object.assign(target, patch);
    await repository.save(target);
  }

  await reassignRelations(workspaceId, object, input.loserRecordIds, input.targetRecordId);

  for (const loser of losers) {
    await repository.softRemove(loser as object);
  }

  await updateSearchVector(repository as Repository<object>, fields, target);
  await writeMergeTimelineNote(workspaceId, object, fields, input.targetRecordId, losers.length, actor);

  return decodeRecord(fields, target, restrictedForRead);
}

/** Best-effort activity note on the surviving record — mirrors record.service.ts's own timeline write. */
async function writeMergeTimelineNote(
  workspaceId: string,
  object: ObjectMetadataEntity,
  fields: FieldMetadataEntity[],
  targetRecordId: string,
  mergedCount: number,
  actor: ActorRole,
): Promise<void> {
  if (!fields.some((f) => f.name === 'timeline_activities')) return;
  try {
    const timelineObject = await dataSource
      .getRepository(ObjectMetadataEntity)
      .findOneBy({ workspaceId, nameSingular: 'timeline_activity', isActive: true });
    if (!timelineObject) return;
    const repo = await getRepository(workspaceId, timelineObject);
    const stamp: Record<string, unknown> = actor.member
      ? {
          source: 'WORKSPACE_MEMBER',
          workspace_member_id: actor.member.id,
          name: `${actor.member.firstName} ${actor.member.lastName}`.trim(),
          context: null,
        }
      : { source: 'API', workspace_member_id: null, name: actor.apiKeyName ?? 'API Key', context: null };
    const row: Record<string, unknown> = {
      name: `Merged ${mergedCount} record${mergedCount === 1 ? '' : 's'} into this ${object.labelSingular}`,
      happens_at: new Date(),
      target_target_type: object.nameSingular,
      target_target_id: targetRecordId,
      properties: null,
    };
    for (const [suffix, value] of Object.entries(stamp)) {
      row[`created_by_${suffix}`] = value;
      row[`updated_by_${suffix}`] = value;
    }
    await repo.save(repo.create(row));
  } catch (err) {
    logger.error({ err, objectId: object.id, targetRecordId }, 'merge timeline note failed');
  }
}
