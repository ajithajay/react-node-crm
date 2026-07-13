import type { DataSource, EntityManager } from 'typeorm';
import { identifierSchema, RelationOnDeleteAction, RelationType, FieldMetadataType } from '@saasly/shared';
import { ObjectMetadataEntity } from '../entities/object-metadata.entity.js';
import { FieldMetadataEntity } from '../entities/field-metadata.entity.js';
import { IndexMetadataEntity } from '../entities/index-metadata.entity.js';
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
  defaultValue?: unknown;
  /** Declaration order within the object; defaults to appended-last (max existing position + 1). */
  position?: number;
}

export interface UpdateObjectInput {
  workspaceId: string;
  objectMetadataId: string;
  labelSingular: string;
  labelPlural: string;
  icon?: string;
  description?: string;
}

export interface DeleteObjectInput {
  workspaceId: string;
  schemaName: string;
  objectMetadataId: string;
  tableName: string;
}

export interface UpdateFieldInput {
  workspaceId: string;
  schemaName: string;
  tableName: string;
  fieldMetadataId: string;
  label: string;
  icon?: string;
  description?: string;
  settings?: FieldMetadataLike['settings'];
  defaultValue?: unknown;
}

export interface CreateIndexInput {
  workspaceId: string;
  schemaName: string;
  objectMetadataId: string;
  tableName: string;
  name: string;
  columnNames: string[];
  isUnique?: boolean;
  indexType?: 'BTREE' | 'GIN';
}

export interface DeleteIndexInput {
  workspaceId: string;
  schemaName: string;
  indexMetadataId: string;
}

export interface CreateMorphRelationInput {
  workspaceId: string;
  schemaName: string;
  sourceObjectMetadataId: string;
  sourceTableName: string;
  forwardName: string;
  forwardLabel: string;
  forwardIcon?: string;
  targetObjectMetadataIds: string[];
  /** Reverse field created on each target object; names are per-target (dedup handled by caller). */
  reverseName: string;
  reverseLabel: string;
  reverseIcon?: string;
  onDelete: RelationOnDeleteAction;
  isNullable?: boolean;
  isCustom?: boolean;
}

export interface DeleteFieldInput {
  workspaceId: string;
  schemaName: string;
  tableName: string;
  fieldMetadataId: string;
}

export interface CreateRelationInput {
  workspaceId: string;
  schemaName: string;
  sourceObjectMetadataId: string;
  sourceTableName: string;
  forwardName: string;
  forwardLabel: string;
  forwardIcon?: string;
  targetObjectMetadataId: string;
  targetTableName: string;
  reverseName: string;
  reverseLabel: string;
  reverseIcon?: string;
  onDelete: RelationOnDeleteAction;
  isNullable?: boolean;
  /** Relation type from the source object's perspective. MANY_TO_ONE puts the FK column on the source. */
  relationType?: RelationType;
  isCustom?: boolean;
}

/**
 * Always-on system/audit fields seeded as metadata-only rows on every object (the physical columns
 * live in `WorkspaceSchemaManager`'s base DDL). Non-restrictable — can't be permission-locked,
 * deactivated, or deleted. Shared by the standard-object seed and custom-object creation.
 */
export const SYSTEM_FIELD_DEFS: {
  name: string;
  label: string;
  type: FieldMetadataType;
  icon: string;
  isNullable: boolean;
}[] = [
  { name: 'created_at', label: 'Creation date', type: FieldMetadataType.DATE_TIME, icon: 'CalendarPlus', isNullable: false },
  { name: 'updated_at', label: 'Last update', type: FieldMetadataType.DATE_TIME, icon: 'CalendarClock', isNullable: false },
  { name: 'deleted_at', label: 'Deleted at', type: FieldMetadataType.DATE_TIME, icon: 'CalendarX', isNullable: true },
  { name: 'created_by', label: 'Created by', type: FieldMetadataType.ACTOR, icon: 'UserPlus', isNullable: true },
  { name: 'updated_by', label: 'Updated by', type: FieldMetadataType.ACTOR, icon: 'UserCog', isNullable: true },
];

const ON_DELETE_SQL: Record<RelationOnDeleteAction, 'CASCADE' | 'RESTRICT' | 'SET NULL' | 'NO ACTION'> = {
  CASCADE: 'CASCADE',
  RESTRICT: 'RESTRICT',
  SET_NULL: 'SET NULL',
  NO_ACTION: 'NO ACTION',
};

/** Next available `position` for a new field on an object: max existing position + 1 (appended last). */
async function nextFieldPosition(manager: EntityManager, workspaceId: string, objectMetadataId: string): Promise<number> {
  const { max } = await manager
    .getRepository(FieldMetadataEntity)
    .createQueryBuilder('f')
    .select('MAX(f.position)', 'max')
    .where('f.workspace_id = :workspaceId', { workspaceId })
    .andWhere('f.object_metadata_id = :objectMetadataId', { objectMetadataId })
    .getRawOne<{ max: string | null }>()
    .then((row) => ({ max: row?.max ?? null }));
  return max === null ? 0 : parseInt(max, 10) + 1;
}

async function bumpMetadataVersion(manager: EntityManager, workspaceId: string): Promise<void> {
  await manager.query(
    `INSERT INTO "core"."workspace_metadata_versions" (workspace_id, version)
     VALUES ($1, 1)
     ON CONFLICT (workspace_id)
     DO UPDATE SET version = "core"."workspace_metadata_versions".version + 1, updated_at = now()`,
    [workspaceId],
  );
}

/** Shared by `createField` and `createRelation`'s forward side: write the metadata row + run its DDL. */
async function insertFieldWithDdl(manager: EntityManager, input: CreateFieldInput): Promise<FieldMetadataEntity> {
  const queryRunner = manager.queryRunner!;
  const repo = manager.getRepository(FieldMetadataEntity);

  const isNullable = input.isNullable ?? true;
  const isUnique = input.isUnique ?? false;
  const settings = input.settings ?? null;
  const position = input.position ?? (await nextFieldPosition(manager, input.workspaceId, input.objectMetadataId));

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
    defaultValue: input.defaultValue ?? null,
    position,
  });
  await repo.save(field);

  const mapped = mapFieldToColumns(
    { name: input.name, type: input.type, isNullable, isUnique, settings },
    input.schemaName,
    input.tableName,
  );

  if (mapped.enumType) {
    await WorkspaceSchemaManager.createEnumType(queryRunner, input.schemaName, mapped.enumType.name, mapped.enumType.values);
  }

  for (const column of mapped.columns) {
    await WorkspaceSchemaManager.addColumn(queryRunner, input.schemaName, input.tableName, column);
  }

  if (input.type === 'RELATION' && settings?.relationTargetObjectMetadataId) {
    const target = await manager
      .getRepository(ObjectMetadataEntity)
      .findOneByOrFail({ id: settings.relationTargetObjectMetadataId });
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

  return field;
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
        const field = await insertFieldWithDdl(manager, input);
        await bumpMetadataVersion(manager, input.workspaceId);
        return field;
      });
    },

    /** Seed the metadata-only system/audit field rows (created_at/…/updated_by) on a freshly-created object. */
    async seedSystemFields(input: { workspaceId: string; objectMetadataId: string }): Promise<void> {
      const repo = coreDataSource.getRepository(FieldMetadataEntity);
      const startPosition = await nextFieldPosition(coreDataSource.manager, input.workspaceId, input.objectMetadataId);
      await repo.save(
        SYSTEM_FIELD_DEFS.map((field, i) =>
          repo.create({
            workspaceId: input.workspaceId,
            objectMetadataId: input.objectMetadataId,
            name: field.name,
            label: field.label,
            type: field.type,
            icon: field.icon,
            isNullable: field.isNullable,
            isUnique: false,
            isCustom: false,
            isSystem: true,
            isRestrictable: false,
            position: startPosition + i,
          }),
        ),
      );
    },

    /**
     * Give a newly-created custom object the standard starter fields Twenty seeds: a required `name`
     * TEXT field (set as the record label) plus the system/audit fields. Runs in one transaction.
     */
    async seedNewObjectDefaults(input: {
      workspaceId: string;
      schemaName: string;
      objectMetadataId: string;
      tableName: string;
    }): Promise<FieldMetadataEntity> {
      return coreDataSource.transaction(async (manager) => {
        const nameField = await insertFieldWithDdl(manager, {
          workspaceId: input.workspaceId,
          schemaName: input.schemaName,
          objectMetadataId: input.objectMetadataId,
          tableName: input.tableName,
          name: 'name',
          label: 'Name',
          type: FieldMetadataType.TEXT,
          icon: 'CaseSensitive',
          isNullable: false,
          isCustom: false,
          isSystem: false,
        });

        const repo = manager.getRepository(FieldMetadataEntity);
        const startPosition = await nextFieldPosition(manager, input.workspaceId, input.objectMetadataId);
        await repo.save(
          SYSTEM_FIELD_DEFS.map((field, i) =>
            repo.create({
              workspaceId: input.workspaceId,
              objectMetadataId: input.objectMetadataId,
              name: field.name,
              label: field.label,
              type: field.type,
              icon: field.icon,
              isNullable: field.isNullable,
              isUnique: false,
              isCustom: false,
              isSystem: true,
              isRestrictable: false,
              position: startPosition + i,
            }),
          ),
        );

        const objRepo = manager.getRepository(ObjectMetadataEntity);
        const object = await objRepo.findOneByOrFail({ id: input.objectMetadataId, workspaceId: input.workspaceId });
        object.labelIdentifierFieldMetadataId = nameField.id;
        await objRepo.save(object);

        await bumpMetadataVersion(manager, input.workspaceId);
        return nameField;
      });
    },

    /** Label/icon/description only — renaming the underlying table/column isn't supported (no DDL rename). */
    async updateObject(input: UpdateObjectInput): Promise<ObjectMetadataEntity> {
      return coreDataSource.transaction(async (manager) => {
        const repo = manager.getRepository(ObjectMetadataEntity);
        const object = await repo.findOneByOrFail({ id: input.objectMetadataId, workspaceId: input.workspaceId });
        object.labelSingular = input.labelSingular;
        object.labelPlural = input.labelPlural;
        object.icon = input.icon ?? null;
        object.description = input.description ?? null;
        await repo.save(object);
        await bumpMetadataVersion(manager, input.workspaceId);
        return object;
      });
    },

    async setObjectActive(workspaceId: string, objectMetadataId: string, isActive: boolean): Promise<void> {
      await coreDataSource.transaction(async (manager) => {
        await manager.getRepository(ObjectMetadataEntity).update({ id: objectMetadataId, workspaceId }, { isActive });
        await bumpMetadataVersion(manager, workspaceId);
      });
    },

    /** Drops the physical table (CASCADE) and the metadata row — field/object permissions and views cascade with it. */
    async deleteObject(input: DeleteObjectInput): Promise<void> {
      await coreDataSource.transaction(async (manager) => {
        const queryRunner = manager.queryRunner!;
        await WorkspaceSchemaManager.dropTable(queryRunner, input.schemaName, input.tableName);
        await manager
          .getRepository(ObjectMetadataEntity)
          .delete({ id: input.objectMetadataId, workspaceId: input.workspaceId });
        await bumpMetadataVersion(manager, input.workspaceId);
      });
    },

    /**
     * Editable properties: label, icon, description, render `settings` (options/formats/subfields) and
     * default value. The field's type and physical column(s) are immutable. Editing a SELECT field's
     * options only ever *adds* enum values via DDL (Postgres cannot drop them).
     */
    async updateField(input: UpdateFieldInput): Promise<FieldMetadataEntity> {
      return coreDataSource.transaction(async (manager) => {
        const repo = manager.getRepository(FieldMetadataEntity);
        const field = await repo.findOneByOrFail({ id: input.fieldMetadataId, workspaceId: input.workspaceId });

        field.label = input.label;
        field.icon = input.icon ?? null;
        field.description = input.description ?? null;

        if (input.settings !== undefined) {
          if (field.type === 'SELECT') {
            const enumName = `${input.tableName}_${field.name}_enum`;
            const values = (input.settings?.options ?? []).map((o) => o.value);
            if (values.length > 0) {
              await WorkspaceSchemaManager.addEnumValues(manager.queryRunner!, input.schemaName, enumName, values);
            }
          }
          field.settings = input.settings ?? null;
        }
        if (input.defaultValue !== undefined) {
          field.defaultValue = input.defaultValue;
        }

        await repo.save(field);
        await bumpMetadataVersion(manager, input.workspaceId);
        return field;
      });
    },

    /** Set/clear an object's record-label + record-image identifier fields (Twenty's "Options" card). */
    async setObjectIdentifiers(
      workspaceId: string,
      objectMetadataId: string,
      labelIdentifierFieldMetadataId: string | null,
      imageIdentifierFieldMetadataId: string | null,
    ): Promise<ObjectMetadataEntity> {
      return coreDataSource.transaction(async (manager) => {
        const repo = manager.getRepository(ObjectMetadataEntity);
        const object = await repo.findOneByOrFail({ id: objectMetadataId, workspaceId });
        object.labelIdentifierFieldMetadataId = labelIdentifierFieldMetadataId;
        object.imageIdentifierFieldMetadataId = imageIdentifierFieldMetadataId;
        await repo.save(object);
        await bumpMetadataVersion(manager, workspaceId);
        return object;
      });
    },

    async createIndex(input: CreateIndexInput): Promise<IndexMetadataEntity> {
      return coreDataSource.transaction(async (manager) => {
        const repo = manager.getRepository(IndexMetadataEntity);
        const index = repo.create({
          workspaceId: input.workspaceId,
          objectMetadataId: input.objectMetadataId,
          name: input.name,
          isUnique: input.isUnique ?? false,
          columnNames: input.columnNames,
        });
        await repo.save(index);
        await WorkspaceSchemaManager.createIndex(
          manager.queryRunner!,
          input.schemaName,
          input.tableName,
          input.name,
          input.columnNames,
          { isUnique: input.isUnique, indexType: input.indexType },
        );
        await bumpMetadataVersion(manager, input.workspaceId);
        return index;
      });
    },

    async deleteIndex(input: DeleteIndexInput): Promise<void> {
      await coreDataSource.transaction(async (manager) => {
        const repo = manager.getRepository(IndexMetadataEntity);
        const index = await repo.findOneByOrFail({ id: input.indexMetadataId, workspaceId: input.workspaceId });
        await WorkspaceSchemaManager.dropIndex(manager.queryRunner!, input.schemaName, index.name);
        await repo.delete({ id: input.indexMetadataId });
        await bumpMetadataVersion(manager, input.workspaceId);
      });
    },

    async setFieldActive(workspaceId: string, fieldMetadataId: string, isActive: boolean): Promise<void> {
      await coreDataSource.transaction(async (manager) => {
        await manager.getRepository(FieldMetadataEntity).update({ id: fieldMetadataId, workspaceId }, { isActive });
        await bumpMetadataVersion(manager, workspaceId);
      });
    },

    /** Drops the field's column(s) (a relation's reverse side has none) and its metadata row. */
    async deleteField(input: DeleteFieldInput): Promise<void> {
      await coreDataSource.transaction(async (manager) => {
        const queryRunner = manager.queryRunner!;
        const repo = manager.getRepository(FieldMetadataEntity);
        const field = await repo.findOneByOrFail({ id: input.fieldMetadataId, workspaceId: input.workspaceId });

        const mapped = mapFieldToColumns(
          { name: field.name, type: field.type, isNullable: field.isNullable, isUnique: field.isUnique, settings: field.settings },
          input.schemaName,
          input.tableName,
        );
        const isVirtualRelationSide = field.type === 'RELATION' && field.settings?.relationType === 'ONE_TO_MANY';
        if (!isVirtualRelationSide) {
          for (const column of mapped.columns) {
            await WorkspaceSchemaManager.dropColumn(queryRunner, input.schemaName, input.tableName, column.name);
          }
        }

        await repo.delete({ id: input.fieldMetadataId });
        await bumpMetadataVersion(manager, input.workspaceId);
      });
    },

    /**
     * Creates both sides of a to-one relation in one transaction: the forward field (physical
     * `<name>_id` FK column, `MANY_TO_ONE`) on the source object, and a metadata-only reverse field
     * (`ONE_TO_MANY`, no physical column — it's a virtual "list of records that point back at me")
     * on the target object. Mirrors Twenty's model; see `relationTargetFieldName` in the shared
     * settings schema, which anticipated this but had no creator implementation until now.
     */
    async createRelation(input: CreateRelationInput): Promise<{ forward: FieldMetadataEntity; reverse: FieldMetadataEntity }> {
      identifierSchema.parse(input.forwardName);
      identifierSchema.parse(input.reverseName);
      const relationType = input.relationType ?? RelationType.MANY_TO_ONE;
      const isCustom = input.isCustom ?? true;

      return coreDataSource.transaction(async (manager) => {
        const repo = manager.getRepository(FieldMetadataEntity);

        /** The MANY_TO_ONE side owns the physical `<name>_id` FK column + constraint. */
        const manyToOneOnSource = relationType === RelationType.MANY_TO_ONE;
        const fkOwner = manyToOneOnSource
          ? {
              objectMetadataId: input.sourceObjectMetadataId,
              tableName: input.sourceTableName,
              name: input.forwardName,
              label: input.forwardLabel,
              icon: input.forwardIcon,
              targetObjectMetadataId: input.targetObjectMetadataId,
              targetTableName: input.targetTableName,
              reverseName: input.reverseName,
            }
          : {
              objectMetadataId: input.targetObjectMetadataId,
              tableName: input.targetTableName,
              name: input.reverseName,
              label: input.reverseLabel,
              icon: input.reverseIcon,
              targetObjectMetadataId: input.sourceObjectMetadataId,
              targetTableName: input.sourceTableName,
              reverseName: input.forwardName,
            };

        const fkField = await insertFieldWithDdl(manager, {
          workspaceId: input.workspaceId,
          schemaName: input.schemaName,
          objectMetadataId: fkOwner.objectMetadataId,
          tableName: fkOwner.tableName,
          name: fkOwner.name,
          label: fkOwner.label,
          icon: fkOwner.icon,
          type: 'RELATION',
          isNullable: input.isNullable ?? true,
          isCustom,
          settings: {
            relationType: 'MANY_TO_ONE',
            relationTargetObjectMetadataId: fkOwner.targetObjectMetadataId,
            relationTargetFieldName: fkOwner.reverseName,
            relationOnDelete: input.onDelete,
          },
        });

        const virtual = manyToOneOnSource
          ? {
              objectMetadataId: input.targetObjectMetadataId,
              name: input.reverseName,
              label: input.reverseLabel,
              icon: input.reverseIcon,
              targetObjectMetadataId: input.sourceObjectMetadataId,
              reverseName: input.forwardName,
            }
          : {
              objectMetadataId: input.sourceObjectMetadataId,
              name: input.forwardName,
              label: input.forwardLabel,
              icon: input.forwardIcon,
              targetObjectMetadataId: input.targetObjectMetadataId,
              reverseName: input.reverseName,
            };

        const virtualField = repo.create({
          workspaceId: input.workspaceId,
          objectMetadataId: virtual.objectMetadataId,
          name: virtual.name,
          label: virtual.label,
          icon: virtual.icon ?? null,
          type: 'RELATION',
          isNullable: true,
          isUnique: false,
          isCustom,
          isSystem: false,
          settings: {
            relationType: 'ONE_TO_MANY',
            relationTargetObjectMetadataId: virtual.targetObjectMetadataId,
            relationTargetFieldName: virtual.reverseName,
          },
          position: await nextFieldPosition(manager, input.workspaceId, virtual.objectMetadataId),
        });
        await repo.save(virtualField);

        await bumpMetadataVersion(manager, input.workspaceId);
        return manyToOneOnSource
          ? { forward: fkField, reverse: virtualField }
          : { forward: virtualField, reverse: fkField };
      });
    },

    /**
     * Polymorphic relation: the source object "belongs to one of" several targets (physical
     * `<name>_target_type`/`<name>_target_id` columns, no FK), and each target object gets a
     * metadata-only ONE_TO_MANY reverse field flagged `isMorphReverse`.
     */
    async createMorphRelation(
      input: CreateMorphRelationInput,
    ): Promise<{ forward: FieldMetadataEntity; reverses: FieldMetadataEntity[] }> {
      identifierSchema.parse(input.forwardName);
      identifierSchema.parse(input.reverseName);
      const isCustom = input.isCustom ?? true;

      return coreDataSource.transaction(async (manager) => {
        const repo = manager.getRepository(FieldMetadataEntity);

        const forward = await insertFieldWithDdl(manager, {
          workspaceId: input.workspaceId,
          schemaName: input.schemaName,
          objectMetadataId: input.sourceObjectMetadataId,
          tableName: input.sourceTableName,
          name: input.forwardName,
          label: input.forwardLabel,
          icon: input.forwardIcon,
          type: 'MORPH_RELATION',
          isNullable: input.isNullable ?? true,
          isCustom,
          settings: {
            relationType: 'MANY_TO_ONE',
            morphTargetObjectMetadataIds: input.targetObjectMetadataIds,
            relationTargetFieldName: input.reverseName,
            relationOnDelete: input.onDelete,
          },
        });

        const reverses: FieldMetadataEntity[] = [];
        for (const targetObjectMetadataId of input.targetObjectMetadataIds) {
          const reverse = repo.create({
            workspaceId: input.workspaceId,
            objectMetadataId: targetObjectMetadataId,
            name: input.reverseName,
            label: input.reverseLabel,
            icon: input.reverseIcon ?? null,
            type: 'RELATION',
            isNullable: true,
            isUnique: false,
            isCustom,
            isSystem: false,
            settings: {
              relationType: 'ONE_TO_MANY',
              relationTargetObjectMetadataId: input.sourceObjectMetadataId,
              relationTargetFieldName: input.forwardName,
              isMorphReverse: true,
            },
            position: await nextFieldPosition(manager, input.workspaceId, targetObjectMetadataId),
          });
          await repo.save(reverse);
          reverses.push(reverse);
        }

        await bumpMetadataVersion(manager, input.workspaceId);
        return { forward, reverses };
      });
    },
  };
}

export type MetadataService = ReturnType<typeof createMetadataService>;
