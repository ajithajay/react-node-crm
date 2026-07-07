import type { QueryRunner } from 'typeorm';
import { assertSafeIdentifier, quoteIdent } from './identifier.util.js';
import type { FieldColumnDefinition } from './field-column-mapper.js';

/**
 * System columns present on every workspace-schema table, regardless of object metadata.
 * `created_by`/`updated_by` are ACTOR composites (source/workspaceMemberId/name/context) — their
 * column naming matches `mapFieldToColumns`' ACTOR mapping so the seeded metadata rows line up.
 */
const SYSTEM_COLUMNS_SQL = `
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "position" int NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  "created_by_source" text,
  "created_by_workspace_member_id" uuid,
  "created_by_name" text,
  "created_by_context" jsonb,
  "updated_by_source" text,
  "updated_by_workspace_member_id" uuid,
  "updated_by_name" text,
  "updated_by_context" jsonb
`;

function columnSql(column: FieldColumnDefinition): string {
  const parts = [quoteIdent(column.name), column.sqlType];
  if (!column.isNullable) parts.push('NOT NULL');
  return parts.join(' ');
}

/** Raw, identifier-escaped DDL against a workspace schema. Every name MUST be pre-validated. */
export const WorkspaceSchemaManager = {
  async createTable(
    runner: QueryRunner,
    schemaName: string,
    tableName: string,
    columns: FieldColumnDefinition[],
  ): Promise<void> {
    assertSafeIdentifier(tableName);
    const extra = columns.map((c) => `,\n  ${columnSql(c)}`).join('');
    await runner.query(`
      CREATE TABLE IF NOT EXISTS ${quoteIdent(schemaName)}.${quoteIdent(tableName)} (
        ${SYSTEM_COLUMNS_SQL.trim()}${extra}
      );
    `);
  },

  async dropTable(runner: QueryRunner, schemaName: string, tableName: string): Promise<void> {
    assertSafeIdentifier(tableName);
    await runner.query(
      `DROP TABLE IF EXISTS ${quoteIdent(schemaName)}.${quoteIdent(tableName)} CASCADE;`,
    );
  },

  async addColumn(
    runner: QueryRunner,
    schemaName: string,
    tableName: string,
    column: FieldColumnDefinition,
  ): Promise<void> {
    assertSafeIdentifier(tableName);
    await runner.query(`
      ALTER TABLE ${quoteIdent(schemaName)}.${quoteIdent(tableName)}
      ADD COLUMN IF NOT EXISTS ${columnSql(column)};
    `);
    if (column.isUnique) {
      const indexName = `${tableName}_${column.name}_key`;
      await runner.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS ${quoteIdent(indexName)}
        ON ${quoteIdent(schemaName)}.${quoteIdent(tableName)} (${quoteIdent(column.name)});
      `);
    }
  },

  async dropColumn(
    runner: QueryRunner,
    schemaName: string,
    tableName: string,
    columnName: string,
  ): Promise<void> {
    assertSafeIdentifier(tableName);
    assertSafeIdentifier(columnName);
    await runner.query(`
      ALTER TABLE ${quoteIdent(schemaName)}.${quoteIdent(tableName)}
      DROP COLUMN IF EXISTS ${quoteIdent(columnName)};
    `);
  },

  async createEnumType(
    runner: QueryRunner,
    schemaName: string,
    enumName: string,
    values: string[],
  ): Promise<void> {
    const exists = await runner.query(
      `SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
       WHERE t.typname = $1 AND n.nspname = $2`,
      [enumName, schemaName],
    );
    if (exists.length > 0) return;
    const literal = values.length > 0 ? values.map((v) => `'${v.replace(/'/g, "''")}'`).join(', ') : "''";
    await runner.query(
      `CREATE TYPE ${quoteIdent(schemaName)}.${quoteIdent(enumName)} AS ENUM (${literal});`,
    );
  },

  /**
   * Add any missing values to an existing enum type. Postgres cannot DROP enum values, so editing a
   * SELECT field's options only ever *adds* new ones — removed options are dropped from metadata but
   * their enum value lingers harmlessly in the type. `ADD VALUE` cannot run inside a txn block before
   * PG12; we're on 17, where `ADD VALUE ... IF NOT EXISTS` is transaction-safe.
   */
  async addEnumValues(
    runner: QueryRunner,
    schemaName: string,
    enumName: string,
    values: string[],
  ): Promise<void> {
    const existing: { enumlabel: string }[] = await runner.query(
      `SELECT e.enumlabel FROM pg_enum e
       JOIN pg_type t ON t.oid = e.enumtypid
       JOIN pg_namespace n ON n.oid = t.typnamespace
       WHERE t.typname = $1 AND n.nspname = $2`,
      [enumName, schemaName],
    );
    const known = new Set(existing.map((row) => row.enumlabel));
    for (const value of values) {
      if (known.has(value)) continue;
      await runner.query(
        `ALTER TYPE ${quoteIdent(schemaName)}.${quoteIdent(enumName)} ADD VALUE IF NOT EXISTS '${value.replace(/'/g, "''")}';`,
      );
    }
  },

  async createIndex(
    runner: QueryRunner,
    schemaName: string,
    tableName: string,
    indexName: string,
    columnNames: string[],
    opts: { isUnique?: boolean; indexType?: 'BTREE' | 'GIN' } = {},
  ): Promise<void> {
    assertSafeIdentifier(tableName);
    assertSafeIdentifier(indexName);
    columnNames.forEach((column) => assertSafeIdentifier(column));
    const unique = opts.isUnique ? 'UNIQUE ' : '';
    const using = opts.indexType === 'GIN' ? ' USING gin' : '';
    const cols = columnNames.map(quoteIdent).join(', ');
    await runner.query(`
      CREATE ${unique}INDEX IF NOT EXISTS ${quoteIdent(indexName)}
      ON ${quoteIdent(schemaName)}.${quoteIdent(tableName)}${using} (${cols});
    `);
  },

  async dropIndex(runner: QueryRunner, schemaName: string, indexName: string): Promise<void> {
    assertSafeIdentifier(indexName);
    await runner.query(`DROP INDEX IF EXISTS ${quoteIdent(schemaName)}.${quoteIdent(indexName)};`);
  },

  async addForeignKey(
    runner: QueryRunner,
    schemaName: string,
    tableName: string,
    columnName: string,
    refTableName: string,
    onDelete: 'CASCADE' | 'RESTRICT' | 'SET NULL' | 'NO ACTION',
  ): Promise<void> {
    assertSafeIdentifier(tableName);
    assertSafeIdentifier(columnName);
    assertSafeIdentifier(refTableName);
    const constraintName = `${tableName}_${columnName}_fkey`;
    await runner.query(`
      ALTER TABLE ${quoteIdent(schemaName)}.${quoteIdent(tableName)}
      ADD CONSTRAINT ${quoteIdent(constraintName)}
      FOREIGN KEY (${quoteIdent(columnName)})
      REFERENCES ${quoteIdent(schemaName)}.${quoteIdent(refTableName)} ("id")
      ON DELETE ${onDelete};
    `);
  },
};
