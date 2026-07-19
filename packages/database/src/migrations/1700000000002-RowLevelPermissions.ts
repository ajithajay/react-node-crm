import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Row-level permission rules: a flat, ordered AND/OR condition list per role+object. */
export class RowLevelPermissions1700000000002 implements MigrationInterface {
  name = 'RowLevelPermissions1700000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "core"."row_level_permissions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "role_id" uuid NOT NULL REFERENCES "core"."roles"("id") ON DELETE CASCADE,
        "object_metadata_id" uuid NOT NULL REFERENCES "core"."object_metadata"("id") ON DELETE CASCADE,
        "field_metadata_id" uuid NOT NULL REFERENCES "core"."field_metadata"("id") ON DELETE CASCADE,
        "operand" varchar NOT NULL,
        "value_mode" varchar NOT NULL DEFAULT 'LITERAL',
        "value" jsonb,
        "logical_operator" varchar NOT NULL DEFAULT 'AND',
        "position" int NOT NULL DEFAULT 0
      );
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_row_level_permissions_role_object" ON "core"."row_level_permissions" ("role_id", "object_metadata_id");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "core"."row_level_permissions";`);
  }
}
