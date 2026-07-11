import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Settings → Layout (BRD §7.2): lets a field be hidden from a record's Overview tab without deactivating it. */
export class AddRecordPageVisibilityToFields1700000000005 implements MigrationInterface {
  name = 'AddRecordPageVisibilityToFields1700000000005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "core"."field_metadata"
      ADD COLUMN "is_visible_in_record_page" boolean NOT NULL DEFAULT true;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "core"."field_metadata" DROP COLUMN "is_visible_in_record_page";`);
  }
}
