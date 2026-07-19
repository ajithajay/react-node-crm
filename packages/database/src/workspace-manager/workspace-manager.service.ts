import type { DataSource } from 'typeorm';
import { WorkspaceEntity, WorkspaceActivationStatus } from '../entities/workspace.entity.js';
import { ObjectMetadataEntity } from '../entities/object-metadata.entity.js';
import { FieldMetadataEntity } from '../entities/field-metadata.entity.js';
import { RoleEntity } from '../entities/role.entity.js';
import { ViewEntity, ViewFieldEntity } from '../entities/view.entity.js';
import { createWorkspaceSchema } from '../workspace-schema/workspace-schema.service.js';
import { getWorkspaceSchemaName } from '../workspace-schema/schema-name.util.js';
import { createMetadataService, SYSTEM_FIELD_DEFS } from '../metadata/metadata.service.js';
import {
  STANDARD_OBJECTS,
  STANDARD_RELATIONS,
  STANDARD_MORPH_RELATIONS,
  STANDARD_TABLE_VIEW_FIELDS,
} from './standard-objects.seed.js';
import { DEFAULT_ROLE_NAME, STANDARD_ROLES } from './standard-roles.seed.js';
import { seedPageLayoutForObject } from './page-layout.seed.js';
import { seedInitialDashboard } from './dashboard.seed.js';

/** Objects that render via their own page_layout (Phase 7 dashboards), not a generic record page. */
const PAGE_LAYOUT_EXCLUDED_SINGULARS = new Set(['dashboard']);

export interface ProvisionWorkspaceResult {
  workspace: WorkspaceEntity;
  objects: ObjectMetadataEntity[];
  roles: RoleEntity[];
}

/**
 * Provision a newly-created workspace: create its Postgres schema,
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
  const viewIdByObjectName = new Map<string, string>();

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
      if (def.labelField === field.name) labelFieldId = created.id;
    }

    await fieldRepo.save(
      SYSTEM_FIELD_DEFS.map((field, i) =>
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
          position: def.fields.length + i,
        }),
      ),
    );

    if (labelFieldId) {
      await metadataService.setObjectIdentifiers(workspaceId, object.id, labelFieldId, null);
    }

    const view = await coreDataSource.getRepository(ViewEntity).save(
      coreDataSource.getRepository(ViewEntity).create({
        workspaceId,
        objectMetadataId: object.id,
        name: `All ${def.labelPlural}`,
        type: 'TABLE',
        position: 0,
        isDefault: true,
      }),
    );
    viewIdByObjectName.set(def.nameSingular, view.id);

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

  // Pass 3.5 — curated default TABLE-view columns, now that relation fields exist.
  // Every column-eligible field gets an explicit row (curated ones first, then any leftover
  // column-eligible field hidden) so the Fields picker never shows a field as "shown" that isn't
  // actually seeded as a column, and vice versa.
  const viewFieldRepo = coreDataSource.getRepository(ViewFieldEntity);
  for (const [objectName, columns] of Object.entries(STANDARD_TABLE_VIEW_FIELDS)) {
    const object = objectIdByName.get(objectName);
    const viewId = viewIdByObjectName.get(objectName);
    if (!object || !viewId) continue;

    const fields = await fieldRepo.findBy({ workspaceId, objectMetadataId: object.id });
    const fieldIdByName = new Map(fields.map((f) => [f.name, f.id]));
    const isColumnEligible = (f: FieldMetadataEntity) =>
      f.type !== 'MORPH_RELATION' && !(f.type === 'RELATION' && f.settings?.relationType === 'ONE_TO_MANY');

    const curatedNames = new Set(columns.map((c) => c.name));
    const leftover = fields.filter((f) => isColumnEligible(f) && !curatedNames.has(f.name));
    const allColumns = [...columns, ...leftover.map((f) => ({ name: f.name, hidden: true }))];

    await viewFieldRepo.save(
      allColumns
        .filter((col) => fieldIdByName.has(col.name))
        .map((col, i) =>
          viewFieldRepo.create({
            viewId,
            fieldMetadataId: fieldIdByName.get(col.name)!,
            position: i,
            isVisible: !col.hidden,
            size: 'size' in col ? (col.size ?? 150) : 150,
          }),
        ),
    );
  }

  // Pass 4 — default record-page layout per object (needs all fields + relations to exist first).
  for (const object of objects) {
    if (PAGE_LAYOUT_EXCLUDED_SINGULARS.has(object.nameSingular)) continue;
    await coreDataSource.transaction((manager) => seedPageLayoutForObject(manager, workspaceId, object));
  }

  // Pass 5 — seed "My First Dashboard" (Phase 7), over the Company/Opportunity objects just created.
  const dashboardObject = objectIdByName.get('dashboard');
  const companyObject = objectIdByName.get('company');
  const opportunityObject = objectIdByName.get('opportunity');
  if (dashboardObject && companyObject && opportunityObject) {
    await coreDataSource.transaction((manager) =>
      seedInitialDashboard(manager, workspaceId, schemaName, {
        dashboard: dashboardObject,
        company: companyObject,
        opportunity: opportunityObject,
      }),
    );
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
