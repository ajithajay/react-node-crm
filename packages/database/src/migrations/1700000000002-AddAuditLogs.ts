import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Adds the audit-log trail used by Settings → General → Logs (BRD §7.1). */
export class AddAuditLogs1700000000002 implements MigrationInterface {
  name = 'AddAuditLogs1700000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "core"."audit_logs" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "workspace_id" uuid NOT NULL REFERENCES "core"."workspaces"("id") ON DELETE CASCADE,
        "actor_user_id" uuid REFERENCES "core"."users"("id") ON DELETE SET NULL,
        "action" varchar NOT NULL,
        "target_type" varchar,
        "target_id" varchar,
        "metadata" jsonb,
        "created_at" timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX "IDX_audit_logs_workspace_created" ON "core"."audit_logs" ("workspace_id", "created_at");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "core"."audit_logs";`);
  }
}
