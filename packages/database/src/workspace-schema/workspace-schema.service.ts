import type { DataSource, QueryRunner } from 'typeorm';
import { assertSafeIdentifier, quoteIdent } from '../ddl/identifier.util.js';
import { WORKSPACE_SCHEMA_NAME_REGEX } from './schema-name.util.js';

/** Create a workspace's Postgres schema. Idempotent. */
export async function createWorkspaceSchema(
  runner: DataSource | QueryRunner,
  schemaName: string,
): Promise<void> {
  assertSafeIdentifier(schemaName, WORKSPACE_SCHEMA_NAME_REGEX);
  await runner.query(`CREATE SCHEMA IF NOT EXISTS ${quoteIdent(schemaName)}`);
}

/** Drop a workspace's Postgres schema and everything in it. Irreversible. */
export async function dropWorkspaceSchema(
  runner: DataSource | QueryRunner,
  schemaName: string,
): Promise<void> {
  assertSafeIdentifier(schemaName, WORKSPACE_SCHEMA_NAME_REGEX);
  await runner.query(`DROP SCHEMA IF EXISTS ${quoteIdent(schemaName)} CASCADE`);
}
