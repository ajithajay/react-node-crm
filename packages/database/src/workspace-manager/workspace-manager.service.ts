import type { DataSource } from 'typeorm';
import { WorkspaceEntity, WorkspaceActivationStatus } from '../entities/workspace.entity.js';
import { ObjectMetadataEntity } from '../entities/object-metadata.entity.js';
import { FieldMetadataEntity } from '../entities/field-metadata.entity.js';
import { RoleEntity } from '../entities/role.entity.js';
import { ViewEntity } from '../entities/view.entity.js';
import { PageLayoutSectionEntity } from '../entities/page-layout-section.entity.js';
import { createWorkspaceSchema } from '../workspace-schema/workspace-schema.service.js';
import { getWorkspaceSchemaName } from '../workspace-schema/schema-name.util.js';
import { createMetadataService, SYSTEM_FIELD_DEFS } from '../metadata/metadata.service.js';
import { STANDARD_OBJECTS, STANDARD_RELATIONS, STANDARD_MORPH_RELATIONS } from './standard-objects.seed.js';
import { DEFAULT_ROLE_NAME, STANDARD_ROLES } from './standard-roles.seed.js';

export interface ProvisionWorkspaceResult {
  workspace: WorkspaceEntity;
  objects: ObjectMetadataEntity[];
  roles: RoleEntity[];
}

/**
 * Provision a newly-created workspace (solution-approach.md §4.8): create its Postgres schema,
 * seed the standard objects/fields/relations/views through the metadata→DDL engine, and seed
 * default roles. Relations are seeded in a second/third pass because they reference other objects.
 * The `workspaces` row must already exist before calling this.
 */
export async function provisionWorkspace(
  coreDataSource: DataSource,
  workspaceId: string,
): Promise<ProvisionWorkspaceResult> {
  const workspaceRepo = coreDataSource.getRepository(WorkspaceEntity);
  const workspace = await workspaceRepo.findOneByOrFail({ id: workspaceId });

  const schemaName = getWorkspaceSchemaName(workspaceId);
  await createWorkspaceSchema(coreDataSource, schemaName);

  workspace.databaseSchema = schemaName;
  await workspaceRepo.save(workspace);

  const metadataService = createMetadataService(coreDataSource);
  const fieldRepo = coreDataSource.getRepository(FieldMetadataEntity);
  const objects: ObjectMetadataEntity[] = [];
  const objectIdByName = new Map<string, ObjectMetadataEntity>();

  // Pass 1 — objects + their scalar/system fields + default view + record-label identifier.
  for (const def of STANDARD_OBJECTS) {
    const object = await metadataService.createObject({
      workspaceId,
      schemaName,
      nameSingular: def.nameSingular,
      namePlural: def.namePlural,
      labelSingular: def.labelSingular,
      labelPlural: def.labelPlural,
      icon: def.icon,
      description: def.description,
      isCustom: false,
      isSystem: true,
    });

    let labelFieldId: string | null = null;
    const fieldIdByName = new Map<string, string>();
    for (const field of def.fields) {
      const created = await metadataService.createField({
        workspaceId,
        schemaName,
        objectMetadataId: object.id,
        tableName: object.namePlural,
        name: field.name,
        label: field.label,
        type: field.type,
        icon: field.icon,
        isNullable: field.isNullable ?? true,
        isUnique: field.isUnique ?? false,
        settings: field.settings,
        isCustom: false,
        isSystem: true,
      });
      fieldIdByName.set(field.name, created.id);
      if (def.labelField === field.name) labelFieldId = created.id;
    }

    // Seed default record-page sections (Twenty parity — e.g. Company's General/Business/Contact).
    if (def.sections?.length) {
      const sectionRepo = coreDataSource.getRepository(PageLayoutSectionEntity);
      await sectionRepo.save(
        def.sections.map((section, position) =>
          sectionRepo.create({
            workspaceId,
            objectMetadataId: object.id,
            label: section.label,
            position,
            fieldMetadataIds: section.fieldNames
              .map((name) => fieldIdByName.get(name))
              .filter((id): id is string => !!id),
          }),
        ),
      );
    }

    await fieldRepo.save(
      SYSTEM_FIELD_DEFS.map((field) =>
        fieldRepo.create({
          workspaceId,
          objectMetadataId: object.id,
          name: field.name,
          label: field.label,
          type: field.type,
          icon: field.icon,
          isNullable: field.isNullable,
          isUnique: false,
          isCustom: false,
          isSystem: true,
          isRestrictable: false,
        }),
      ),
    );

    if (labelFieldId) {
      await metadataService.setObjectIdentifiers(workspaceId, object.id, labelFieldId, null);
    }

    await coreDataSource.getRepository(ViewEntity).save(
      coreDataSource.getRepository(ViewEntity).create({
        workspaceId,
        objectMetadataId: object.id,
        name: `All ${def.labelPlural}`,
        type: 'TABLE',
        position: 0,
        isDefault: true,
      }),
    );

    objects.push(object);
    objectIdByName.set(def.nameSingular, object);
  }

  // Pass 2 — regular relations between the objects created above.
  for (const rel of STANDARD_RELATIONS) {
    const source = objectIdByName.get(rel.source)!;
    const target = objectIdByName.get(rel.target)!;
    await metadataService.createRelation({
      workspaceId,
      schemaName,
      sourceObjectMetadataId: source.id,
      sourceTableName: source.namePlural,
      forwardName: rel.forwardName,
      forwardLabel: rel.forwardLabel,
      forwardIcon: rel.forwardIcon,
      targetObjectMetadataId: target.id,
      targetTableName: target.namePlural,
      reverseName: rel.reverseName,
      reverseLabel: rel.reverseLabel,
      reverseIcon: rel.reverseIcon,
      onDelete: rel.onDelete,
      relationType: rel.relationType,
      isCustom: false,
    });
  }

  // Pass 3 — polymorphic (morph) relations from the junction/activity objects.
  for (const morph of STANDARD_MORPH_RELATIONS) {
    const source = objectIdByName.get(morph.source)!;
    await metadataService.createMorphRelation({
      workspaceId,
      schemaName,
      sourceObjectMetadataId: source.id,
      sourceTableName: source.namePlural,
      forwardName: morph.forwardName,
      forwardLabel: morph.forwardLabel,
      forwardIcon: morph.forwardIcon,
      targetObjectMetadataIds: morph.targets.map((name) => objectIdByName.get(name)!.id),
      reverseName: morph.reverseName,
      reverseLabel: morph.reverseLabel,
      reverseIcon: morph.reverseIcon,
      onDelete: morph.onDelete,
      isCustom: false,
    });
  }

  const roleRepo = coreDataSource.getRepository(RoleEntity);
  const roles = await roleRepo.save(
    STANDARD_ROLES.map((def) =>
      roleRepo.create({
        workspaceId,
        name: def.name,
        label: def.label,
        icon: def.icon,
        isEditable: def.isEditable,
        canUpdateAllSettings: def.canUpdateAllSettings,
        canReadAllObjectRecords: def.canReadAllObjectRecords,
        canUpdateAllObjectRecords: def.canUpdateAllObjectRecords,
        canSoftDeleteAllObjectRecords: def.canSoftDeleteAllObjectRecords,
        canDestroyAllObjectRecords: def.canDestroyAllObjectRecords,
        canAccessAllTools: def.canAccessAllTools,
      }),
    ),
  );

  const defaultRole = roles.find((r) => r.name === DEFAULT_ROLE_NAME);
  workspace.defaultRoleId = defaultRole?.id ?? null;
  workspace.activationStatus = WorkspaceActivationStatus.ACTIVE;
  await workspaceRepo.save(workspace);

  return { workspace, objects, roles };
}
