import type { MigrationInterface, QueryRunner } from 'typeorm';

/** `duplicate_criteria`: an OR of AND-groups of fieldMetadataIds, for duplicate-record detection. */
export class DuplicateCriteria1700000000003 implements MigrationInterface {
  name = 'DuplicateCriteria1700000000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "core"."object_metadata" ADD COLUMN IF NOT EXISTS "duplicate_criteria" jsonb;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "core"."object_metadata" DROP COLUMN IF EXISTS "duplicate_criteria";
    `);
  }
}
