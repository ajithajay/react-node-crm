import { EntitySchema, type EntitySchemaColumnOptions } from 'typeorm';
import type { ObjectMetadataEntity } from '../entities/object-metadata.entity.js';
import type { FieldMetadataEntity } from '../entities/field-metadata.entity.js';
import { mapFieldToEntityColumns } from './entity-column-mapper.js';

const SYSTEM_COLUMNS: Record<string, EntitySchemaColumnOptions> = {
  id: { type: 'uuid', primary: true, generated: 'uuid' },
  position: { type: 'int', default: 0 },
  createdAt: { type: 'timestamptz', createDate: true, name: 'created_at' },
  updatedAt: { type: 'timestamptz', updateDate: true, name: 'updated_at' },
  deletedAt: { type: 'timestamptz', deleteDate: true, name: 'deleted_at', nullable: true },
};

/**
 * Field names already backed by SYSTEM_COLUMNS above — their metadata rows exist only for the
 * settings/permission UI, so the factory must NOT re-map them (a duplicate physical column would
 * make TypeORM emit the same column twice). `created_by`/`updated_by` are NOT here: they aren't in
 * SYSTEM_COLUMNS, so their ACTOR sub-columns are mapped normally.
 */
const BASE_SYSTEM_FIELD_NAMES: ReadonlySet<string> = new Set(['id', 'position', 'created_at', 'updated_at', 'deleted_at']);

/**
 * Build a TypeORM EntitySchema for one object, from its current field metadata. Schema-qualified
 * so generated SQL is fully qualified (`workspace_xxx.company`) — no `search_path` juggling.
 */
export function buildEntitySchema(
  object: Pick<ObjectMetadataEntity, 'nameSingular' | 'namePlural'>,
  fields: FieldMetadataEntity[],
  schemaName: string,
): EntitySchema {
  const columns: Record<string, EntitySchemaColumnOptions> = { ...SYSTEM_COLUMNS };

  for (const field of fields) {
    if (BASE_SYSTEM_FIELD_NAMES.has(field.name)) continue;
    Object.assign(columns, mapFieldToEntityColumns(field, object.namePlural));
  }

  return new EntitySchema({
    name: object.nameSingular,
    tableName: object.namePlural,
    schema: schemaName,
    columns,
  });
}
