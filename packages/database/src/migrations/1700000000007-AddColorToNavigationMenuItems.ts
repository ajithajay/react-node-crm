import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Sidebar item accent color (Twenty's per-item "Customize > Color"), null = default (blue). */
export class AddColorToNavigationMenuItems1700000000007 implements MigrationInterface {
  name = 'AddColorToNavigationMenuItems1700000000007';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "core"."navigation_menu_items" ADD COLUMN "color" varchar;`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "core"."navigation_menu_items" DROP COLUMN "color";`);
  }
}
