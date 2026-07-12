import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { CORE_ENTITIES } from './entities/index.js';
import { InitialCoreSchema1700000000000 } from './migrations/1700000000000-InitialCoreSchema.js';
import { AddNumberFormatToWorkspaceMembers1700000000001 } from './migrations/1700000000001-AddNumberFormatToWorkspaceMembers.js';
import { AddAuditLogs1700000000002 } from './migrations/1700000000002-AddAuditLogs.js';
import { AddRoleToInvitations1700000000003 } from './migrations/1700000000003-AddRoleToInvitations.js';
import { AddIconToRoles1700000000004 } from './migrations/1700000000004-AddIconToRoles.js';
import { AddRecordPageVisibilityToFields1700000000005 } from './migrations/1700000000005-AddRecordPageVisibilityToFields.js';
import { AddPageLayouts1700000000006 } from './migrations/1700000000006-AddPageLayouts.js';
import { AddColorToNavigationMenuItems1700000000007 } from './migrations/1700000000007-AddColorToNavigationMenuItems.js';
import { AddPinnedToPageLayoutTabs1700000000008 } from './migrations/1700000000008-AddPinnedToPageLayoutTabs.js';

/** Shared control-plane schema (identity, tenancy, metadata). Per-workspace schemas: see workspace-schema/. */
export const CORE_SCHEMA = 'core';

/**
 * Build the core DataSource. `synchronize` stays false — schema changes go through the
 * versioned migration below, never ad hoc sync.
 */
export function createCoreDataSource(databaseUrl: string): DataSource {
  return new DataSource({
    type: 'postgres',
    url: databaseUrl,
    schema: CORE_SCHEMA,
    entities: CORE_ENTITIES,
    migrations: [
      InitialCoreSchema1700000000000,
      AddNumberFormatToWorkspaceMembers1700000000001,
      AddAuditLogs1700000000002,
      AddRoleToInvitations1700000000003,
      AddIconToRoles1700000000004,
      AddRecordPageVisibilityToFields1700000000005,
      AddPageLayouts1700000000006,
      AddColorToNavigationMenuItems1700000000007,
      AddPinnedToPageLayoutTabs1700000000008,
    ],
    migrationsTableName: '_migrations',
    synchronize: false,
    logging: false,
  });
}

/** Idempotently create the core schema (must exist before migrations can create tables in it). */
export async function ensureCoreSchema(dataSource: DataSource): Promise<void> {
  await dataSource.query(`CREATE SCHEMA IF NOT EXISTS "${CORE_SCHEMA}"`);
}

/** Run pending core migrations. Safe to call on every boot (no-op once applied). */
export async function runCoreMigrations(dataSource: DataSource): Promise<void> {
  await dataSource.runMigrations();
}
