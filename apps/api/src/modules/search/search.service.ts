import { FieldMetadataEntity, ObjectMetadataEntity } from '@saasly/database';
import { toCamelCase } from '@saasly/shared';
import { dataSource } from '../../lib/db.js';
import { workspaceDataSourceCache } from '../../lib/workspace-data-source.js';
import { decodeRecord } from '../record/record-field-codec.js';
import { applyRowLevelPermission } from '../record/row-level-permission.js';
import {
  assertObjectAccess,
  resolveActorRole,
  resolveFieldRestrictions,
  type Principal,
} from '../record/record-permission.js';

/** Results per object table, and overall, are capped — this is a quick-jump palette, not a full search results page. */
const PER_OBJECT_LIMIT = 5;
const OVERALL_LIMIT = 20;

export interface SearchResult {
  objectMetadataId: string;
  objectNamePlural: string;
  objectLabel: string;
  icon: string | null;
  recordId: string;
  label: string;
  rank: number;
}

/** Renders a decoded field value (string, or a FULL_NAME composite) down to a display label. */
export function displayValue(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && ('firstName' in (value as object) || 'lastName' in (value as object))) {
    const v = value as { firstName?: string; lastName?: string };
    return [v.firstName, v.lastName].filter(Boolean).join(' ');
  }
  return String(value);
}

/**
 * Cross-object full-text search, scoped to what the caller can actually read: objects the role
 * can't read at all are skipped, objects whose label-identifier field is itself read-restricted
 * are skipped (nothing sensible to show as a label), and each object's own row-level permission
 * rule (if any) is applied to the underlying query — same enforcement as the record list/get API.
 */
export async function searchWorkspace(
  workspaceId: string,
  principal: Principal,
  query: string,
): Promise<SearchResult[]> {
  const actor = await resolveActorRole(principal, workspaceId);
  const objects = await dataSource.getRepository(ObjectMetadataEntity).findBy({ workspaceId, isActive: true });
  const workspaceDs = await workspaceDataSourceCache.getWorkspaceDataSource(workspaceId);

  const resultsPerObject = await Promise.all(
    objects.map(async (object): Promise<SearchResult[]> => {
      if (!object.labelIdentifierFieldMetadataId) return [];
      try {
        await assertObjectAccess(actor, object.id, 'read');
      } catch {
        return [];
      }

      const fields = await dataSource
        .getRepository(FieldMetadataEntity)
        .findBy({ workspaceId, objectMetadataId: object.id, isActive: true });
      const { restrictedForRead } = await resolveFieldRestrictions(
        actor,
        fields.map((f) => f.id),
      );
      if (restrictedForRead.has(object.labelIdentifierFieldMetadataId)) return [];

      const identifierField = fields.find((f) => f.id === object.labelIdentifierFieldMetadataId);
      if (!identifierField) return [];

      const repository = workspaceDs.getRepository(object.nameSingular);
      const alias = object.nameSingular;
      const qb = repository
        .createQueryBuilder(alias)
        .addSelect(`ts_rank("${alias}"."search_vector", plainto_tsquery('english', :q))`, 'rank')
        .where(`"${alias}"."search_vector" @@ plainto_tsquery('english', :q)`, { q: query })
        .orderBy('rank', 'DESC')
        .limit(PER_OBJECT_LIMIT);
      await applyRowLevelPermission(qb, alias, actor, object.id, fields);

      const { entities, raw } = await qb.getRawAndEntities();
      const identifierKey = toCamelCase(identifierField.name);

      return entities.map((row, index) => {
        const decoded = decodeRecord(fields, row as Record<string, unknown>, restrictedForRead);
        const label = displayValue(decoded[identifierKey]);
        return {
          objectMetadataId: object.id,
          objectNamePlural: object.namePlural,
          objectLabel: object.labelSingular,
          icon: object.icon,
          recordId: decoded.id as string,
          label: label || (decoded.id as string),
          rank: Number((raw[index] as { rank?: number } | undefined)?.rank ?? 0),
        };
      });
    }),
  );

  return resultsPerObject
    .flat()
    .sort((a, b) => b.rank - a.rank)
    .slice(0, OVERALL_LIMIT);
}
