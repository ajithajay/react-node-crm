import { Brackets, type SelectQueryBuilder } from 'typeorm';
import type { FieldMetadataEntity, ObjectMetadataEntity } from '@saasly/database';
import { FieldMetadataType, toCamelCase } from '@saasly/shared';
import { workspaceDataSourceCache } from '../../lib/workspace-data-source.js';
import { NotFoundError } from '../../lib/errors.js';
import { displayValue } from '../search/search.service.js';
import { decodeRecord } from './record-field-codec.js';
import { applyRowLevelPermission } from './row-level-permission.js';
import { resolveActiveFields, resolveObject } from './record.service.js';
import {
  assertObjectAccess,
  resolveActorRole,
  resolveFieldRestrictions,
  type Principal,
} from './record-permission.js';

const MAX_MATCHES = 10;

export interface DuplicateMatch {
  recordId: string;
  label: string;
}

/**
 * The physical column(s) a field's value must equal on *both* records for that field to count
 * toward a duplicate-criteria group — only fields with a single, well-defined "identity" value are
 * eligible (composite types like FULL_NAME contribute all their sub-columns, ANDed together).
 * Returns `null` for field types with no sensible equality notion here (e.g. reverse relations).
 */
function equalityColumns(field: FieldMetadataEntity): string[] | null {
  switch (field.type) {
    case FieldMetadataType.TEXT:
    case FieldMetadataType.NUMBER:
    case FieldMetadataType.DATE:
    case FieldMetadataType.DATE_TIME:
    case FieldMetadataType.BOOLEAN:
    case FieldMetadataType.SELECT:
    case FieldMetadataType.UUID:
      return [field.name];
    case FieldMetadataType.RELATION:
      return field.settings?.relationType === 'ONE_TO_MANY' ? null : [`${field.name}_id`];
    case FieldMetadataType.EMAILS:
      return [`${field.name}_primary_email`];
    case FieldMetadataType.LINKS:
      return [`${field.name}_primary_link_url`];
    case FieldMetadataType.FULL_NAME:
      return [`${field.name}_first_name`, `${field.name}_last_name`];
    default:
      return null;
  }
}

/**
 * Finds up to `MAX_MATCHES` other records matching `sourceRow` on any one of the object's
 * `duplicateCriteria` groups (an OR of AND-groups of fieldMetadataIds — see
 * `ObjectMetadataEntity.duplicateCriteria`). A group is skipped entirely if any of its fields is
 * blank on `sourceRow` (an empty value can't meaningfully signal "same record"). Respects the
 * caller's object/field/row-level permissions, same as every other record-reading path.
 */
async function findMatches(
  workspaceId: string,
  actor: Awaited<ReturnType<typeof resolveActorRole>>,
  object: ObjectMetadataEntity,
  fields: FieldMetadataEntity[],
  sourceRow: Record<string, unknown>,
  excludeId: string | null,
): Promise<DuplicateMatch[]> {
  if (!object.duplicateCriteria || object.duplicateCriteria.length === 0) return [];

  const fieldById = new Map(fields.map((f) => [f.id, f]));
  const groups: { columns: string[]; values: unknown[] }[] = [];

  for (const groupFieldIds of object.duplicateCriteria) {
    const columns: string[] = [];
    const values: unknown[] = [];
    let valid = true;
    for (const fieldId of groupFieldIds) {
      const field = fieldById.get(fieldId);
      const cols = field ? equalityColumns(field) : null;
      if (!cols) {
        valid = false;
        break;
      }
      for (const col of cols) {
        const value = sourceRow[col];
        if (value === null || value === undefined || value === '') {
          valid = false;
          break;
        }
        columns.push(col);
        values.push(value);
      }
      if (!valid) break;
    }
    if (valid && columns.length > 0) groups.push({ columns, values });
  }
  if (groups.length === 0) return [];

  const workspaceDs = await workspaceDataSourceCache.getWorkspaceDataSource(workspaceId);
  const repository = workspaceDs.getRepository(object.nameSingular);
  const alias = object.nameSingular;
  const qb: SelectQueryBuilder<object> = repository.createQueryBuilder(alias);
  if (excludeId) qb.where(`"${alias}"."id" != :excludeId`, { excludeId });

  qb.andWhere(
    new Brackets((bqb) => {
      groups.forEach((group, groupIndex) => {
        const params: Record<string, unknown> = {};
        const clause = group.columns
          .map((col, i) => {
            const p = `dup_${groupIndex}_${i}`;
            params[p] = group.values[i];
            return `"${alias}"."${col}" = :${p}`;
          })
          .join(' AND ');
        if (groupIndex === 0) bqb.where(clause, params);
        else bqb.orWhere(clause, params);
      });
    }),
  );
  await applyRowLevelPermission(qb, alias, actor, object.id, fields);

  const rows = await qb.take(MAX_MATCHES).getMany();
  const { restrictedForRead } = await resolveFieldRestrictions(
    actor,
    fields.map((f) => f.id),
  );
  const identifierField = object.labelIdentifierFieldMetadataId
    ? fieldById.get(object.labelIdentifierFieldMetadataId)
    : undefined;

  return rows.map((row) => {
    const decoded = decodeRecord(fields, row as Record<string, unknown>, restrictedForRead);
    const label = identifierField ? displayValue(decoded[toCamelCase(identifierField.name)]) : '';
    return { recordId: decoded.id as string, label: label || (decoded.id as string) };
  });
}

/** Possible duplicates of an existing record — powers the record detail page's "Duplicates" section. */
export async function findDuplicatesForRecord(
  workspaceId: string,
  principal: Principal,
  objectNamePlural: string,
  recordId: string,
): Promise<DuplicateMatch[]> {
  const object = await resolveObject(workspaceId, objectNamePlural);
  const actor = await resolveActorRole(principal, workspaceId);
  await assertObjectAccess(actor, object.id, 'read');
  if (!object.duplicateCriteria || object.duplicateCriteria.length === 0) return [];

  const fields = await resolveActiveFields(workspaceId, object.id);
  const workspaceDs = await workspaceDataSourceCache.getWorkspaceDataSource(workspaceId);
  const repository = workspaceDs.getRepository(object.nameSingular);
  const row = await repository.findOneBy({ id: recordId });
  if (!row) throw new NotFoundError('Record not found');

  return findMatches(workspaceId, actor, object, fields, row as Record<string, unknown>, recordId);
}
