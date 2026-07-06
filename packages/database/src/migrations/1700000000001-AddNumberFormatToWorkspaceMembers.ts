import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Adds the number-format preference used by Settings → Experience (BRD §6). */
export class AddNumberFormatToWorkspaceMembers1700000000001 implements MigrationInterface {
  name = 'AddNumberFormatToWorkspaceMembers1700000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "core"."workspace_members"
      ADD COLUMN "number_format" varchar NOT NULL DEFAULT '1,000.00';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "core"."workspace_members" DROP COLUMN "number_format";`);
  }
}
