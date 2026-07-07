import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Lets a role show a lucide icon in the sidebar/list (matches Twenty's role icon picker). */
export class AddIconToRoles1700000000004 implements MigrationInterface {
  name = 'AddIconToRoles1700000000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "core"."roles"
      ADD COLUMN "icon" varchar NOT NULL DEFAULT 'User';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "core"."roles" DROP COLUMN "icon";`);
  }
}
