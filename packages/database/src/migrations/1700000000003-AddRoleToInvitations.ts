import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Lets an inviter pick the role a member joins with (BRD §7.3 Invite tab). */
export class AddRoleToInvitations1700000000003 implements MigrationInterface {
  name = 'AddRoleToInvitations1700000000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "core"."invitations"
      ADD COLUMN "role_id" uuid REFERENCES "core"."roles"("id") ON DELETE SET NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "core"."invitations" DROP COLUMN "role_id";`);
  }
}
