import type { MigrationInterface, QueryRunner } from 'typeorm';

/** New workspace members should land on light theme by default, not the OS-following "system" mode. */
export class MembershipColorSchemeDefaultLight1700000000001 implements MigrationInterface {
  name = 'MembershipColorSchemeDefaultLight1700000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "core"."workspace_members" ALTER COLUMN "color_scheme" SET DEFAULT 'LIGHT';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "core"."workspace_members" ALTER COLUMN "color_scheme" SET DEFAULT 'SYSTEM';
    `);
  }
}
