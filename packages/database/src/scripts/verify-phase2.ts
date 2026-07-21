import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import {
  createCoreDataSource,
  ensureCoreSchema,
  runCoreMigrations,
  UserEntity,
  WorkspaceEntity,
  createMetadataService,
  createWorkspaceDataSourceCache,
  provisionWorkspace,
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

const TEST_EMAIL = 'verify-phase2@test.local';
const TEST_SUBDOMAIN = 'verify-phase2-test';

async function main(): Promise<void> {
  loadEnv();
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required');

  const coreDataSource = createCoreDataSource(databaseUrl);
  await coreDataSource.initialize();
  await ensureCoreSchema(coreDataSource);
  await runCoreMigrations(coreDataSource);
  console.log('[verify-phase2] core datasource ready, migrations applied');

  await cleanupPreviousRun(coreDataSource);

  console.log('\n1. Create workspace + user rows');
  const user = await coreDataSource.getRepository(UserEntity).save(
    coreDataSource.getRepository(UserEntity).create({
      email: TEST_EMAIL,
      firstName: 'Verify',
      lastName: 'Phase2',
      isEmailVerified: true,
    }),
  );
  const workspace = await coreDataSource.getRepository(WorkspaceEntity).save(
    coreDataSource.getRepository(WorkspaceEntity).create({
      name: 'Verify Phase2 Co',
      subdomain: TEST_SUBDOMAIN,
      databaseSchema: '', // set by provisionWorkspace
    }),
  );
  ok(`user ${user.email} created`);
  ok(`workspace ${workspace.name} created (id: ${workspace.id})`);

  console.log('\n2. Provision workspace (schema + standard objects/fields/views/roles)');
  const { objects, roles } = await provisionWorkspace(coreDataSource, workspace.id);
  assert(objects.length === 18, `expected 18 standard objects, got ${objects.length}`);
  assert(roles.length === 3, `expected 3 default roles, got ${roles.length}`);
  const refreshedWorkspace = await coreDataSource
    .getRepository(WorkspaceEntity)
    .findOneByOrFail({ id: workspace.id });
  assert(
    refreshedWorkspace.databaseSchema.startsWith('workspace_'),
    'workspace.databaseSchema should be set',
  );
  assert(refreshedWorkspace.defaultRoleId !== null, 'workspace.defaultRoleId should be set');
  ok(`${objects.length} standard objects created: ${objects.map((o) => o.nameSingular).join(', ')}`);
  ok(`3 default roles created: ${roles.map((r) => r.name).join(', ')}`);
  ok(`workspace schema: ${refreshedWorkspace.databaseSchema}`);

  const schemaName = refreshedWorkspace.databaseSchema;
  const tableExists = await coreDataSource.query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema = $1 AND table_name = 'companies'`,
    [schemaName],
  );
  assert(tableExists.length === 1, 'workspace schema should have a "companies" table');
  ok('physical "companies" table exists in the workspace schema');

  console.log('\n3. Add a custom field to Company via live DDL');
  const companyObject = objects.find((o) => o.nameSingular === 'company');
  assert(companyObject, 'company object metadata not found');
  const metadataService = createMetadataService(coreDataSource);
  await metadataService.createField({
    workspaceId: workspace.id,
    schemaName,
    objectMetadataId: companyObject!.id,
    tableName: 'companies',
    name: 'linkedin_followers',
    label: 'LinkedIn Followers',
    type: 'NUMBER',
    settings: { numberDataType: 'INT' },
  });

  const columnExists = await coreDataSource.query(
    `SELECT data_type FROM information_schema.columns
     WHERE table_schema = $1 AND table_name = 'companies' AND column_name = 'linkedin_followers'`,
    [schemaName],
  );
  assert(columnExists.length === 1, 'linkedin_followers column should exist after ALTER TABLE');
  ok(`custom column added: linkedin_followers (${columnExists[0].data_type})`);

  const fieldMetadataRow = await coreDataSource.query(
    `SELECT 1 FROM "core"."field_metadata" WHERE object_metadata_id = $1 AND name = 'linkedin_followers'`,
    [companyObject!.id],
  );
  assert(fieldMetadataRow.length === 1, 'field_metadata row should exist for the new field');
  ok('field_metadata row recorded in core schema');

  console.log('\n4. Query the new column through the dynamic EntitySchema (workspace DataSource)');
  const wsCache = createWorkspaceDataSourceCache(coreDataSource, databaseUrl);
  const workspaceDataSource = await wsCache.getWorkspaceDataSource(workspace.id);
  const companyRepo = workspaceDataSource.getRepository('company');

  const inserted = await companyRepo.save(
    companyRepo.create({ name: 'Acme Inc', linkedin_followers: 4200 } as Record<string, unknown>),
  );
  const found = await companyRepo.findOneByOrFail({ id: (inserted as { id: string }).id });
  assert(
    (found as unknown as Record<string, unknown>).linkedin_followers === 4200,
    'inserted linkedin_followers value should round-trip',
  );
  ok(`inserted + queried Company row via dynamic entity (linkedin_followers=${(found as unknown as Record<string, unknown>).linkedin_followers})`);

  await wsCache.closeAll();

  console.log('\n5. Cleanup');
  await cleanupPreviousRun(coreDataSource);
  ok('test workspace/user/schema removed');

  await coreDataSource.destroy();
  console.log('\n✅ Phase 2 verify PASSED');
}

async function cleanupPreviousRun(coreDataSource: import('typeorm').DataSource): Promise<void> {
  const existing = await coreDataSource
    .getRepository(WorkspaceEntity)
    .findOneBy({ subdomain: TEST_SUBDOMAIN });
  if (existing) {
    if (existing.databaseSchema) {
      await coreDataSource.query(`DROP SCHEMA IF EXISTS "${existing.databaseSchema}" CASCADE`);
    }
    await coreDataSource.getRepository(WorkspaceEntity).delete({ id: existing.id });
  }
  await coreDataSource.getRepository(UserEntity).delete({ email: TEST_EMAIL });
}

main().catch((err) => {
  console.error('\n❌ Phase 2 verify FAILED\n', err);
  process.exit(1);
});
