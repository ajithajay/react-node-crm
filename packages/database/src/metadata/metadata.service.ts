import type { DataSource, EntityManager } from 'typeorm';
import { identifierSchema, RelationOnDeleteAction, type FieldMetadataType } from '@saasly/shared';
import { ObjectMetadataEntity } from '../entities/object-metadata.entity.js';
import { FieldMetadataEntity } from '../entities/field-metadata.entity.js';
import { mapFieldToColumns, type FieldMetadataLike } from '../ddl/field-column-mapper.js';
import { WorkspaceSchemaManager } from '../ddl/workspace-schema-manager.js';

export interface CreateObjectInput {
  workspaceId: string;
  schemaName: string;
  nameSingular: string;
  namePlural: string;
  labelSingular: string;
  labelPlural: string;
  icon?: string;
  description?: string;
  isCustom?: boolean;
  isSystem?: boolean;
}

export interface CreateFieldInput {
  workspaceId: string;
  schemaName: string;
  objectMetadataId: string;
  tableName: string;
  name: string;
  label: string;
  type: FieldMetadataType;
  description?: string;
  icon?: string;
  isNullable?: boolean;
  isUnique?: boolean;
  isCustom?: boolean;
  isSystem?: boolean;
  settings?: FieldMetadataLike['settings'];
}

const ON_DELETE_SQL: Record<RelationOnDeleteAction, 'CASCADE' | 'RESTRICT' | 'SET NULL' | 'NO ACTION'> = {
  CASCADE: 'CASCADE',
  RESTRICT: 'RESTRICT',
  SET_NULL: 'SET NULL',
  NO_ACTION: 'NO ACTION',
};

async function bumpMetadataVersion(manager: EntityManager, workspaceId: string): Promise<void> {
  await manager.query(
    `INSERT INTO "core"."workspace_metadata_versions" (workspace_id, version)
     VALUES ($1, 1)
     ON CONFLICT (workspace_id)
     DO UPDATE SET version = "core"."workspace_metadata_versions".version + 1, updated_at = now()`,
    [workspaceId],
  );
}

/**
 * The metadata→DDL engine (solution-approach.md §4.4). Each call writes the metadata row(s) in
 * `core` AND runs the matching DDL against the workspace schema, atomically, then bumps the
 * workspace's metadata version so cached dynamic entities are invalidated.
 */
export function createMetadataService(coreDataSource: DataSource) {
  return {
    async createObject(input: CreateObjectInput): Promise<ObjectMetadataEntity> {
      identifierSchema.parse(input.nameSingular);
      identifierSchema.parse(input.namePlural);

      return coreDataSource.transaction(async (manager) => {
        const queryRunner = manager.queryRunner!;
        const repo = manager.getRepository(ObjectMetadataEntity);

        const object = repo.create({
          workspaceId: input.workspaceId,
          nameSingular: input.nameSingular,
          namePlural: input.namePlural,
          labelSingular: input.labelSingular,
          labelPlural: input.labelPlural,
          icon: input.icon ?? null,
          description: input.description ?? null,
          isCustom: input.isCustom ?? true,
          isSystem: input.isSystem ?? false,
        });
        await repo.save(object);

        await WorkspaceSchemaManager.createTable(queryRunner, input.schemaName, input.namePlural, []);
        await bumpMetadataVersion(manager, input.workspaceId);

        return object;
      });
    },

    async createField(input: CreateFieldInput): Promise<FieldMetadataEntity> {
      identifierSchema.parse(input.name);

      return coreDataSource.transaction(async (manager) => {
        const queryRunner = manager.queryRunner!;
        const repo = manager.getRepository(FieldMetadataEntity);

        const isNullable = input.isNullable ?? true;
        const isUnique = input.isUnique ?? false;
        const settings = input.settings ?? null;

        const field = repo.create({
          workspaceId: input.workspaceId,
          objectMetadataId: input.objectMetadataId,
          name: input.name,
          label: input.label,
          type: input.type,
          description: input.description ?? null,
          icon: input.icon ?? null,
          isCustom: input.isCustom ?? true,
          isSystem: input.isSystem ?? false,
          isNullable,
          isUnique,
          settings,
        });
        await repo.save(field);

        const mapped = mapFieldToColumns(
          { name: input.name, type: input.type, isNullable, isUnique, settings },
          input.schemaName,
          input.tableName,
        );

        if (mapped.enumType) {
          await WorkspaceSchemaManager.createEnumType(
            queryRunner,
            input.schemaName,
            mapped.enumType.name,
            mapped.enumType.values,
          );
        }

        for (const column of mapped.columns) {
          await WorkspaceSchemaManager.addColumn(queryRunner, input.schemaName, input.tableName, column);
        }

        if (input.type === 'RELATION' && settings?.relationTargetObjectMetadataId) {
          const target = await manager.getRepository(ObjectMetadataEntity).findOneByOrFail({
            id: settings.relationTargetObjectMetadataId,
          });
          const onDelete = ON_DELETE_SQL[settings.relationOnDelete ?? 'SET_NULL'];
          await WorkspaceSchemaManager.addForeignKey(
            queryRunner,
            input.schemaName,
            input.tableName,
            `${input.name}_id`,
            target.namePlural,
            onDelete,
          );
        }

        await bumpMetadataVersion(manager, input.workspaceId);

        return field;
      });
    },
  };
}

export type MetadataService = ReturnType<typeof createMetadataService>;
