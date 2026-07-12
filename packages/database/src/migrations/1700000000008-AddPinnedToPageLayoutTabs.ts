import type { MigrationInterface, QueryRunner } from 'typeorm';

/** "Pin tab" (Twenty's default-tab-to-focus) — record-page widget customizer. */
export class AddPinnedToPageLayoutTabs1700000000008 implements MigrationInterface {
  name = 'AddPinnedToPageLayoutTabs1700000000008';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "core"."page_layout_tabs" ADD COLUMN "is_pinned" boolean NOT NULL DEFAULT false;`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "core"."page_layout_tabs" DROP COLUMN "is_pinned";`);
  }
}
