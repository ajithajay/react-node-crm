import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Connected accounts + email/calendar channel config (control-plane).
 * The email/calendar *content* records (message, message_thread, calendar_event, …) are
 * per-workspace standard objects created by the metadata→DDL engine, not here.
 */
export class ConnectedAccountsAndMessaging1700000000004 implements MigrationInterface {
  name = 'ConnectedAccountsAndMessaging1700000000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "core"."workspaces"
        ADD COLUMN IF NOT EXISTS "sync_internal_emails" boolean NOT NULL DEFAULT false;
    `);

    await queryRunner.query(`
      CREATE TABLE "core"."connected_accounts" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "workspace_id" uuid NOT NULL REFERENCES "core"."workspaces"("id") ON DELETE CASCADE,
        "workspace_member_id" uuid NOT NULL REFERENCES "core"."workspace_members"("id") ON DELETE CASCADE,
        "provider" varchar NOT NULL,
        "handle" varchar NOT NULL,
        "handle_aliases" jsonb NOT NULL DEFAULT '[]',
        "access_token_ciphertext" varchar,
        "refresh_token_ciphertext" varchar,
        "token_expires_at" timestamptz,
        "scopes" jsonb NOT NULL DEFAULT '[]',
        "connection_parameters" jsonb,
        "auth_status" varchar NOT NULL DEFAULT 'PENDING',
        "auth_failed_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz
      );
      CREATE INDEX "IDX_connected_accounts_ws_member" ON "core"."connected_accounts" ("workspace_id", "workspace_member_id");
    `);

    await queryRunner.query(`
      CREATE TABLE "core"."message_channels" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "workspace_id" uuid NOT NULL REFERENCES "core"."workspaces"("id") ON DELETE CASCADE,
        "connected_account_id" uuid NOT NULL REFERENCES "core"."connected_accounts"("id") ON DELETE CASCADE,
        "handle" varchar NOT NULL,
        "type" varchar NOT NULL DEFAULT 'EMAIL',
        "is_sync_enabled" boolean NOT NULL DEFAULT true,
        "sync_cursor" varchar,
        "sync_status" varchar NOT NULL DEFAULT 'NOT_SYNCED',
        "sync_stage" varchar NOT NULL DEFAULT 'FULL_MESSAGE_LIST_FETCH_PENDING',
        "sync_stage_started_at" timestamptz,
        "last_synced_at" timestamptz,
        "throttle_failure_count" int NOT NULL DEFAULT 0,
        "visibility" varchar NOT NULL DEFAULT 'SHARE_EVERYTHING',
        "is_contact_auto_creation_enabled" boolean NOT NULL DEFAULT true,
        "contact_auto_creation_policy" varchar NOT NULL DEFAULT 'SENT',
        "exclude_group_emails" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX "IDX_message_channels_account" ON "core"."message_channels" ("connected_account_id");
    `);

    await queryRunner.query(`
      CREATE TABLE "core"."calendar_channels" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "workspace_id" uuid NOT NULL REFERENCES "core"."workspaces"("id") ON DELETE CASCADE,
        "connected_account_id" uuid NOT NULL REFERENCES "core"."connected_accounts"("id") ON DELETE CASCADE,
        "handle" varchar NOT NULL,
        "is_sync_enabled" boolean NOT NULL DEFAULT true,
        "sync_cursor" varchar,
        "sync_status" varchar NOT NULL DEFAULT 'NOT_SYNCED',
        "sync_stage" varchar NOT NULL DEFAULT 'FULL_MESSAGE_LIST_FETCH_PENDING',
        "sync_stage_started_at" timestamptz,
        "last_synced_at" timestamptz,
        "throttle_failure_count" int NOT NULL DEFAULT 0,
        "visibility" varchar NOT NULL DEFAULT 'SHARE_EVERYTHING',
        "is_contact_auto_creation_enabled" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX "IDX_calendar_channels_account" ON "core"."calendar_channels" ("connected_account_id");
    `);

    await queryRunner.query(`
      CREATE TABLE "core"."message_folders" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "workspace_id" uuid NOT NULL REFERENCES "core"."workspaces"("id") ON DELETE CASCADE,
        "message_channel_id" uuid NOT NULL REFERENCES "core"."message_channels"("id") ON DELETE CASCADE,
        "name" varchar NOT NULL,
        "external_id" varchar,
        "is_sent_folder" boolean NOT NULL DEFAULT false,
        "is_synced" boolean NOT NULL DEFAULT true,
        "sync_cursor" varchar,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX "IDX_message_folders_channel" ON "core"."message_folders" ("message_channel_id");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "core"."message_folders";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "core"."calendar_channels";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "core"."message_channels";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "core"."connected_accounts";`);
    await queryRunner.query(`ALTER TABLE "core"."workspaces" DROP COLUMN IF EXISTS "sync_internal_emails";`);
  }
}
