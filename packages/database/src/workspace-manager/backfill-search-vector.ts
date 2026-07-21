import type { DataSource } from 'typeorm';
import { FieldMetadataType } from '@saasly/shared';
import { FieldMetadataEntity } from '../entities/field-metadata.entity.js';
import { ObjectMetadataEntity } from '../entities/object-metadata.entity.js';
import { WorkspaceEntity } from '../entities/workspace.entity.js';
import { WorkspaceSchemaManager } from '../ddl/workspace-schema-manager.js';
import { assertSafeIdentifier, quoteIdent } from '../ddl/identifier.util.js';
import { WORKSPACE_SCHEMA_NAME_REGEX } from '../workspace-schema/schema-name.util.js';

/**
 * Physical column suffixes worth indexing for search on composite field types — just the
 * human-readable/name-like sub-columns (mirrors `SEARCHABLE_COMPOSITE_SUFFIXES` in
 * apps/api/src/modules/record/search-vector.ts, which maintains `search_vector` incrementally on
 * every write; this file only needs the *initial* bulk recompute for rows that already existed).
 */
const SEARCHABLE_COMPOSITE_SUFFIXES: Partial<Record<FieldMetadataType, string[]>> = {
  [FieldMetadataType.FULL_NAME]: ['first_name', 'last_name'],
  [FieldMetadataType.EMAILS]: ['primary_email'],
  [FieldMetadataType.LINKS]: ['primary_link_label'],
  [FieldMetadataType.ADDRESS]: ['city', 'state', 'country'],
};

function searchableColumnNames(field: Pick<FieldMetadataEntity, 'name' | 'type'>): string[] {
  if (field.type === FieldMetadataType.TEXT) return [field.name];
  const suffixes = SEARCHABLE_COMPOSITE_SUFFIXES[field.type];
  return suffixes ? suffixes.map((suffix) => `${field.name}_${suffix}`) : [];
}

/**
 * `search_vector` was added to the *system* column set after some workspaces/objects — and rows —
 * already existed. `WorkspaceSchemaManager.createTable` only bakes the column into tables created
 * from here on, and the app only recomputes a row's vector on its own next create/update
 * (`apps/api/src/modules/record/search-vector.ts`). This retrofits every already-provisioned
 * object table across every workspace: adds the column/index if missing, then recomputes every
 * existing row's vector from its current name/text-like column values in one `UPDATE` per table
 * (not per row). Fully idempotent (`ADD COLUMN IF NOT EXISTS`, deterministic `UPDATE`), so it's
 * safe to run on every boot (matches `runCoreMigrations`' "safe to call on every boot" contract) —
 * cheap at this app's scale; revisit if a workspace's table count/row count grows large enough for
 * this to matter at startup.
 */
export async function backfillSearchVectorColumn(coreDataSource: DataSource): Promise<void> {
  const workspaces = await coreDataSource.getRepository(WorkspaceEntity).find();
  const schemaByWorkspaceId = new Map(workspaces.map((w) => [w.id, w.databaseSchema]));

  const objects = await coreDataSource.getRepository(ObjectMetadataEntity).find();
  const fields = await coreDataSource.getRepository(FieldMetadataEntity).findBy({ isActive: true });
  const fieldsByObjectId = new Map<string, FieldMetadataEntity[]>();
  for (const field of fields) {
    const list = fieldsByObjectId.get(field.objectMetadataId) ?? [];
    list.push(field);
    fieldsByObjectId.set(field.objectMetadataId, list);
  }

  const queryRunner = coreDataSource.createQueryRunner();
  try {
    for (const object of objects) {
      const schemaName = schemaByWorkspaceId.get(object.workspaceId);
      if (!schemaName) continue;
      assertSafeIdentifier(schemaName, WORKSPACE_SCHEMA_NAME_REGEX);
      assertSafeIdentifier(object.namePlural);

      await WorkspaceSchemaManager.addColumn(queryRunner, schemaName, object.namePlural, {
        name: 'search_vector',
        sqlType: 'tsvector',
        isNullable: true,
      });
      await WorkspaceSchemaManager.ensureSearchVectorIndex(queryRunner, schemaName, object.namePlural);

      const columnNames = (fieldsByObjectId.get(object.id) ?? []).flatMap(searchableColumnNames);
      if (columnNames.length === 0) continue;
      columnNames.forEach((name) => assertSafeIdentifier(name));
      const columnsSql = columnNames.map(quoteIdent).join(', ');

      await queryRunner.query(`
        UPDATE ${quoteIdent(schemaName)}.${quoteIdent(object.namePlural)}
        SET search_vector = to_tsvector('english', concat_ws(' ', ${columnsSql}));
      `);
    }
  } finally {
    await queryRunner.release();
  }
}
