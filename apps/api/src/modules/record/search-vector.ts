import type { Repository } from 'typeorm';
import type { FieldMetadataEntity } from '@saasly/database';
import { FieldMetadataType } from '@saasly/shared';
import { logger } from '../../lib/logger.js';

/**
 * Physical column suffixes (mirrors `COMPOSITE_SHAPE` in record-field-codec.ts) worth indexing for
 * search on composite field types — just the human-readable/name-like sub-columns, not every
 * sub-field (e.g. FULL_NAME's first/last name, not PHONES' calling code).
 */
const SEARCHABLE_COMPOSITE_SUFFIXES: Partial<Record<FieldMetadataType, string[]>> = {
  [FieldMetadataType.FULL_NAME]: ['first_name', 'last_name'],
  [FieldMetadataType.EMAILS]: ['primary_email'],
  [FieldMetadataType.LINKS]: ['primary_link_label'],
  [FieldMetadataType.ADDRESS]: ['city', 'state', 'country'],
};

/** The physical column name(s) of a field worth feeding into `search_vector`, or `[]` if none. */
function searchableColumnNames(field: FieldMetadataEntity): string[] {
  if (field.type === FieldMetadataType.TEXT) return [field.name];
  const suffixes = SEARCHABLE_COMPOSITE_SUFFIXES[field.type];
  return suffixes ? suffixes.map((suffix) => `${field.name}_${suffix}`) : [];
}

/**
 * Recomputes and persists `search_vector` (a plain, app-maintained tsvector column — see
 * `packages/database/src/ddl/workspace-schema-manager.ts`) from the record's current
 * name/text-like field values (plain TEXT fields, plus the human-readable parts of FULL_NAME/
 * EMAILS/LINKS/ADDRESS composites — e.g. Person's `name` is a FULL_NAME, not TEXT, so without this
 * it would never be searchable), after every create/update. Best-effort: search staying briefly
 * stale on a write failure here isn't worth failing the request over (matches the
 * timeline-activity write pattern in record.service.ts).
 */
export async function updateSearchVector(
  repository: Repository<object>,
  fields: FieldMetadataEntity[],
  savedRow: Record<string, unknown>,
): Promise<void> {
  const columnNames = fields.flatMap(searchableColumnNames);
  if (columnNames.length === 0) return;

  const text = columnNames
    .map((name) => savedRow[name])
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
    .join(' ');

  try {
    const { schema, tableName } = repository.metadata;
    await repository.manager.query(
      `UPDATE "${schema}"."${tableName}" SET search_vector = to_tsvector('english', $1) WHERE id = $2`,
      [text, savedRow.id],
    );
  } catch (err) {
    logger.error({ err, recordId: savedRow.id }, 'search_vector update failed');
  }
}
