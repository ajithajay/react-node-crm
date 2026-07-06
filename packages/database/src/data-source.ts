import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { CORE_ENTITIES } from './entities/index.js';
import { InitialCoreSchema1700000000000 } from './migrations/1700000000000-InitialCoreSchema.js';
import { AddNumberFormatToWorkspaceMembers1700000000001 } from './migrations/1700000000001-AddNumberFormatToWorkspaceMembers.js';
import { AddAuditLogs1700000000002 } from './migrations/1700000000002-AddAuditLogs.js';

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
