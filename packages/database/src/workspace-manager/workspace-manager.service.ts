import type { DataSource } from 'typeorm';
import { WorkspaceEntity, WorkspaceActivationStatus } from '../entities/workspace.entity.js';
import { ObjectMetadataEntity } from '../entities/object-metadata.entity.js';
import { RoleEntity } from '../entities/role.entity.js';
import { ViewEntity } from '../entities/view.entity.js';
import { createWorkspaceSchema } from '../workspace-schema/workspace-schema.service.js';
import { getWorkspaceSchemaName } from '../workspace-schema/schema-name.util.js';
import { createMetadataService } from '../metadata/metadata.service.js';
import { STANDARD_OBJECTS } from './standard-objects.seed.js';
import { DEFAULT_ROLE_NAME, STANDARD_ROLES } from './standard-roles.seed.js';

export interface ProvisionWorkspaceResult {
  workspace: WorkspaceEntity;
  objects: ObjectMetadataEntity[];
  roles: RoleEntity[];
}

/**
 * Provision a newly-created workspace (solution-approach.md §4.8): create its Postgres schema,
 * seed the standard objects/fields/views through the metadata→DDL engine, and seed default roles.
 * The `workspaces` row must already exist (created by the signup flow in Phase 3, or a test row
 * in the Phase 2 verify script) before calling this.
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
  const objects: ObjectMetadataEntity[] = [];

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

    for (const field of def.fields) {
      await metadataService.createField({
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
    }

    await coreDataSource.getRepository(ViewEntity).save(
      coreDataSource.getRepository(ViewEntity).create({
        workspaceId,
        objectMetadataId: object.id,
        name: `All ${def.labelPlural}`,
        type: 'TABLE',
        position: 0,
      }),
    );

    objects.push(object);
  }

  const roleRepo = coreDataSource.getRepository(RoleEntity);
  const roles = await roleRepo.save(
    STANDARD_ROLES.map((def) =>
      roleRepo.create({
        workspaceId,
        name: def.name,
        label: def.label,
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
