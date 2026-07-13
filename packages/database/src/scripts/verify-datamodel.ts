/**
 * Phase 5h (Data Model) end-to-end verify. Resets the local DB (drops `core` + every `workspace_*`
 * schema — pre-launch, no data to preserve), re-runs migrations, provisions a fresh workspace, and
 * asserts the new data-model capabilities: full standard-object/field parity (17-field Company),
 * created_by/updated_by ACTOR system fields, record-label identifier, relations + morph relations,
 * editable field settings (SELECT enum growth), and index create/drop via live DDL.
 *
 * Run: pnpm --filter @saasly/database run verify:datamodel
 */
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import type { DataSource } from 'typeorm';
import {
  createCoreDataSource,
  ensureCoreSchema,
  runCoreMigrations,
  createMetadataService,
  createWorkspaceDataSourceCache,
  provisionWorkspace,
  UserEntity,
  WorkspaceEntity,
  ObjectMetadataEntity,
  FieldMetadataEntity,
} from '../index.js';

function loadEnv(): void {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 8; i += 1) {
    const candidate = resolve(dir, '.env');
    if (existsSync(candidate)) {
      dotenv.config({ path: candidate });
      return;
    }
    dir = dirname(dir);
  }
}

function ok(label: string): void {
  console.log(`  ✓ ${label}`);
}
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
}

const TEST_EMAIL = 'verify-datamodel@test.local';
const TEST_SUBDOMAIN = 'verify-datamodel-test';

/** Full local reset — drop every workspace schema and the core schema, then recreate from migrations. */
async function resetDatabase(ds: DataSource): Promise<void> {
  const workspaceSchemas: { schema_name: string }[] = await ds.query(
    `SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'workspace_%'`,
  );
  for (const row of workspaceSchemas) {
    await ds.query(`DROP SCHEMA IF EXISTS "${row.schema_name}" CASCADE`);
  }
  await ds.query(`DROP SCHEMA IF EXISTS "core" CASCADE`);
}

async function columnExists(ds: DataSource, schema: string, table: string, column: string): Promise<boolean> {
  const rows = await ds.query(
    `SELECT 1 FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2 AND column_name = $3`,
    [schema, table, column],
  );
  return rows.length === 1;
}

async function main(): Promise<void> {
  loadEnv();
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required');

  const coreDataSource = createCoreDataSource(databaseUrl);
  await coreDataSource.initialize();

  console.log('\n0. Reset local database (drop core + workspace_* schemas)');
  await resetDatabase(coreDataSource);
  await ensureCoreSchema(coreDataSource);
  await runCoreMigrations(coreDataSource);
  ok('fresh core schema + migrations applied');

  console.log('\n1. Provision a workspace');
  const user = await coreDataSource.getRepository(UserEntity).save(
    coreDataSource.getRepository(UserEntity).create({ email: TEST_EMAIL, firstName: 'DM', lastName: 'Verify', isEmailVerified: true }),
  );
  const workspace = await coreDataSource.getRepository(WorkspaceEntity).save(
    coreDataSource.getRepository(WorkspaceEntity).create({ name: 'DataModel Co', subdomain: TEST_SUBDOMAIN, databaseSchema: '' }),
  );
  const { objects } = await provisionWorkspace(coreDataSource, workspace.id);
  assert(objects.length === 11, `expected 11 standard objects, got ${objects.length}`);
  const ws = await coreDataSource.getRepository(WorkspaceEntity).findOneByOrFail({ id: workspace.id });
  const schema = ws.databaseSchema;
  ok(`11 objects: ${objects.map((o) => o.nameSingular).join(', ')}`);
  void user;

  const objectRepo = coreDataSource.getRepository(ObjectMetadataEntity);
  const fieldRepo = coreDataSource.getRepository(FieldMetadataEntity);
  const company = await objectRepo.findOneByOrFail({ workspaceId: workspace.id, nameSingular: 'company' });

  console.log('\n2. Company field parity (Twenty = 17)');
  const companyFields = await fieldRepo.findBy({ objectMetadataId: company.id });
  assert(companyFields.length === 17, `expected 17 Company fields, got ${companyFields.length}: ${companyFields.map((f) => f.name).join(', ')}`);
  ok(`Company has 17 fields: ${companyFields.map((f) => f.name).join(', ')}`);

  const relationNames = companyFields.filter((f) => f.type === 'RELATION').map((f) => f.name);
  for (const expected of ['people', 'opportunities', 'account_owner', 'note_targets', 'task_targets', 'attachments', 'timeline_activities']) {
    assert(relationNames.includes(expected), `Company should have relation field "${expected}"`);
  }
  ok(`relation fields present: ${relationNames.join(', ')}`);

  console.log('\n3. created_by / updated_by ACTOR system fields');
  const createdBy = companyFields.find((f) => f.name === 'created_by');
  assert(createdBy && createdBy.type === 'ACTOR' && !createdBy.isRestrictable, 'created_by should be a non-restrictable ACTOR field');
  for (const col of ['created_by_source', 'created_by_workspace_member_id', 'created_by_name', 'created_by_context', 'updated_by_source']) {
    assert(await columnExists(coreDataSource, schema, 'companies', col), `companies.${col} column should exist`);
  }
  ok('created_by/updated_by metadata + ACTOR columns present on companies');

  console.log('\n4. Record-label identifier');
  const refreshedCompany = await objectRepo.findOneByOrFail({ id: company.id });
  const nameField = companyFields.find((f) => f.name === 'name');
  assert(refreshedCompany.labelIdentifierFieldMetadataId === nameField!.id, 'Company record label should be its name field');
  ok('Company record-label identifier = name field');

  console.log('\n5. Relation columns / FKs');
  assert(await columnExists(coreDataSource, schema, 'people', 'company_id'), 'people.company_id FK column should exist');
  assert(await columnExists(coreDataSource, schema, 'companies', 'account_owner_id'), 'companies.account_owner_id FK column should exist');
  ok('regular relation FK columns present (people.company_id, companies.account_owner_id)');

  console.log('\n6. Morph relation columns + reverse fields');
  assert(await columnExists(coreDataSource, schema, 'note_targets', 'target_target_type'), 'note_targets morph target_type column should exist');
  assert(await columnExists(coreDataSource, schema, 'note_targets', 'target_target_id'), 'note_targets morph target_id column should exist');
  const morphReverse = companyFields.find((f) => f.name === 'note_targets');
  assert((morphReverse?.settings as { isMorphReverse?: boolean } | null)?.isMorphReverse === true, 'company.note_targets should be a morph reverse');
  ok('morph target columns + morph reverse fields present');

  const metadataService = createMetadataService(coreDataSource);

  console.log('\n7. Custom SELECT field + editable options (enum growth)');
  const tier = await metadataService.createField({
    workspaceId: workspace.id,
    schemaName: schema,
    objectMetadataId: company.id,
    tableName: 'companies',
    name: 'tier',
    label: 'Tier',
    type: 'SELECT',
    settings: { options: [{ value: 'GOLD', label: 'Gold', color: 'yellow', position: 0 }, { value: 'SILVER', label: 'Silver', color: 'gray', position: 1 }] },
  });
  const enumType = await coreDataSource.query(
    `SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid JOIN pg_namespace n ON n.oid = t.typnamespace
     WHERE t.typname = 'companies_tier_enum' AND n.nspname = $1 ORDER BY e.enumsortorder`,
    [schema],
  );
  assert(enumType.length === 2, `tier enum should have 2 values, got ${enumType.length}`);
  ok(`SELECT enum created with values: ${enumType.map((r: { enumlabel: string }) => r.enumlabel).join(', ')}`);

  await metadataService.updateField({
    workspaceId: workspace.id,
    schemaName: schema,
    tableName: 'companies',
    fieldMetadataId: tier.id,
    label: 'Tier',
    settings: {
      options: [
        { value: 'GOLD', label: 'Gold', color: 'yellow', position: 0 },
        { value: 'SILVER', label: 'Silver', color: 'gray', position: 1 },
        { value: 'BRONZE', label: 'Bronze', color: 'orange', position: 2 },
      ],
    },
  });
  const enumAfter = await coreDataSource.query(
    `SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid JOIN pg_namespace n ON n.oid = t.typnamespace
     WHERE t.typname = 'companies_tier_enum' AND n.nspname = $1`,
    [schema],
  );
  assert(enumAfter.length === 3, `tier enum should grow to 3 values, got ${enumAfter.length}`);
  ok('editing SELECT options added a new enum value (BRONZE) via ALTER TYPE');

  console.log('\n8. Index create + drop');
  const index = await metadataService.createIndex({
    workspaceId: workspace.id,
    schemaName: schema,
    objectMetadataId: company.id,
    tableName: 'companies',
    name: 'companies_name_idx',
    columnNames: ['name'],
  });
  const idxRows = await coreDataSource.query(`SELECT 1 FROM pg_indexes WHERE schemaname = $1 AND indexname = 'companies_name_idx'`, [schema]);
  assert(idxRows.length === 1, 'companies_name_idx should exist in pg_indexes');
  ok('index created (companies_name_idx)');
  await metadataService.deleteIndex({ workspaceId: workspace.id, schemaName: schema, indexMetadataId: index.id });
  const idxGone = await coreDataSource.query(`SELECT 1 FROM pg_indexes WHERE schemaname = $1 AND indexname = 'companies_name_idx'`, [schema]);
  assert(idxGone.length === 0, 'companies_name_idx should be dropped');
  ok('index dropped');

  console.log('\n9. Dynamic entity still builds + inserts (with new columns/relations)');
  const wsCache = createWorkspaceDataSourceCache(coreDataSource, databaseUrl);
  const wds = await wsCache.getWorkspaceDataSource(workspace.id);
  const companyRepo = wds.getRepository('company');
  const inserted = await companyRepo.save(companyRepo.create({ name: 'Acme', tier: 'BRONZE' } as Record<string, unknown>));
  const found = await companyRepo.findOneByOrFail({ id: (inserted as { id: string }).id });
  assert((found as Record<string, unknown>).tier === 'BRONZE', 'inserted tier should round-trip through the dynamic entity');
  ok('inserted + queried a Company row (tier=BRONZE) through the rebuilt dynamic entity');
  await wsCache.closeAll();

  console.log('\n10. Custom object gets default starter fields (Name + system fields)');
  const custom = await metadataService.createObject({
    workspaceId: workspace.id,
    schemaName: schema,
    nameSingular: 'project',
    namePlural: 'projects',
    labelSingular: 'Project',
    labelPlural: 'Projects',
    icon: 'Folder',
    isCustom: true,
    isSystem: false,
  });
  await metadataService.seedNewObjectDefaults({ workspaceId: workspace.id, schemaName: schema, objectMetadataId: custom.id, tableName: 'projects' });
  const projectFields = await fieldRepo.findBy({ objectMetadataId: custom.id });
  assert(projectFields.length === 6, `custom object should get 6 default fields, got ${projectFields.length}: ${projectFields.map((f) => f.name).join(', ')}`);
  const projectName = projectFields.find((f) => f.name === 'name');
  assert(projectName && !projectName.isNullable, 'custom object should have a required Name field');
  const refreshedProject = await objectRepo.findOneByOrFail({ id: custom.id });
  assert(refreshedProject.labelIdentifierFieldMetadataId === projectName!.id, 'custom object record label should be its Name field');
  assert(await columnExists(coreDataSource, schema, 'projects', 'name'), 'projects.name column should exist');
  assert(await columnExists(coreDataSource, schema, 'projects', 'created_by_source'), 'projects.created_by_source column should exist');
  ok(`custom "Project" object seeded with: ${projectFields.map((f) => f.name).join(', ')} (record label = name)`);

  await coreDataSource.destroy();
  console.log('\n✅ Data Model (Phase 5h) verify PASSED');
}

main().catch((err) => {
  console.error('\n❌ Data Model verify FAILED\n', err);
  process.exit(1);
});
