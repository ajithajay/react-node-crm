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
    Object.assign(columns, mapFieldToEntityColumns(field, object.namePlural));
  }

  return new EntitySchema({
    name: object.nameSingular,
    tableName: object.namePlural,
    schema: schemaName,
    columns,
  });
}
