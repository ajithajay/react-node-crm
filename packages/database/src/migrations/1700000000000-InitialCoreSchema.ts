import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates every control-plane table in the `core` schema (solution-approach.md §4.2).
 * Per-workspace data-plane tables are created dynamically by the metadata→DDL engine (§4.4),
 * never by a TypeORM migration.
 */
export class InitialCoreSchema1700000000000 implements MigrationInterface {
  name = 'InitialCoreSchema1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "core"."users" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "email" varchar NOT NULL,
        "password_hash" varchar,
        "first_name" varchar NOT NULL DEFAULT '',
        "last_name" varchar NOT NULL DEFAULT '',
        "is_email_verified" boolean NOT NULL DEFAULT false,
        "disabled" boolean NOT NULL DEFAULT false,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      );
      CREATE UNIQUE INDEX "IDX_users_email" ON "core"."users" ("email");
    `);

    await queryRunner.query(`
      CREATE TABLE "core"."workspaces" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" varchar NOT NULL,
        "subdomain" varchar NOT NULL,
        "custom_domain" varchar,
        "logo_url" varchar,
        "database_schema" varchar NOT NULL,
        "activation_status" varchar NOT NULL DEFAULT 'PENDING_CREATION',
        "default_role_id" uuid,
        "is_two_factor_authentication_enforced" boolean NOT NULL DEFAULT false,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      );
      CREATE UNIQUE INDEX "IDX_workspaces_subdomain" ON "core"."workspaces" ("subdomain");
      CREATE UNIQUE INDEX "IDX_workspaces_custom_domain" ON "core"."workspaces" ("custom_domain") WHERE "custom_domain" IS NOT NULL;
    `);

    await queryRunner.query(`
      CREATE TABLE "core"."workspace_metadata_versions" (
        "workspace_id" uuid PRIMARY KEY REFERENCES "core"."workspaces"("id") ON DELETE CASCADE,
        "version" int NOT NULL DEFAULT 1,
        "updated_at" timestamptz NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "core"."roles" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "workspace_id" uuid NOT NULL REFERENCES "core"."workspaces"("id") ON DELETE CASCADE,
        "name" varchar NOT NULL,
        "label" varchar NOT NULL,
        "description" varchar,
        "is_editable" boolean NOT NULL DEFAULT true,
        "can_update_all_settings" boolean NOT NULL DEFAULT false,
        "can_read_all_object_records" boolean NOT NULL DEFAULT false,
        "can_update_all_object_records" boolean NOT NULL DEFAULT false,
        "can_soft_delete_all_object_records" boolean NOT NULL DEFAULT false,
        "can_destroy_all_object_records" boolean NOT NULL DEFAULT false,
        "can_access_all_tools" boolean NOT NULL DEFAULT false,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        UNIQUE ("workspace_id", "name")
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "core"."role_permission_flags" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "role_id" uuid NOT NULL REFERENCES "core"."roles"("id") ON DELETE CASCADE,
        "flag" varchar NOT NULL,
        UNIQUE ("role_id", "flag")
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "core"."user_workspaces" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL REFERENCES "core"."users"("id") ON DELETE CASCADE,
        "workspace_id" uuid NOT NULL REFERENCES "core"."workspaces"("id") ON DELETE CASCADE,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        UNIQUE ("user_id", "workspace_id")
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "core"."workspace_members" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "workspace_id" uuid NOT NULL REFERENCES "core"."workspaces"("id") ON DELETE CASCADE,
        "user_id" uuid NOT NULL REFERENCES "core"."users"("id") ON DELETE CASCADE,
        "role_id" uuid REFERENCES "core"."roles"("id") ON DELETE SET NULL,
        "first_name" varchar NOT NULL DEFAULT '',
        "last_name" varchar NOT NULL DEFAULT '',
        "avatar_url" varchar,
        "color_scheme" varchar NOT NULL DEFAULT 'SYSTEM',
        "locale" varchar NOT NULL DEFAULT 'en',
        "time_zone" varchar NOT NULL DEFAULT 'UTC',
        "date_format" varchar NOT NULL DEFAULT 'MM/DD/YYYY',
        "time_format" varchar NOT NULL DEFAULT 'HH:mm',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        UNIQUE ("workspace_id", "user_id")
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "core"."invitations" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "workspace_id" uuid NOT NULL REFERENCES "core"."workspaces"("id") ON DELETE CASCADE,
        "email" varchar NOT NULL,
        "token_hash" varchar NOT NULL,
        "status" varchar NOT NULL DEFAULT 'PENDING',
        "invited_by_id" uuid REFERENCES "core"."users"("id") ON DELETE SET NULL,
        "expires_at" timestamptz NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        UNIQUE ("workspace_id", "email")
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "core"."object_metadata" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "workspace_id" uuid NOT NULL REFERENCES "core"."workspaces"("id") ON DELETE CASCADE,
        "name_singular" varchar NOT NULL,
        "name_plural" varchar NOT NULL,
        "label_singular" varchar NOT NULL,
        "label_plural" varchar NOT NULL,
        "icon" varchar,
        "description" varchar,
        "label_identifier_field_metadata_id" uuid,
        "image_identifier_field_metadata_id" uuid,
        "is_custom" boolean NOT NULL DEFAULT true,
        "is_active" boolean NOT NULL DEFAULT true,
        "is_system" boolean NOT NULL DEFAULT false,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        UNIQUE ("workspace_id", "name_singular"),
        UNIQUE ("workspace_id", "name_plural")
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "core"."field_metadata" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "workspace_id" uuid NOT NULL REFERENCES "core"."workspaces"("id") ON DELETE CASCADE,
        "object_metadata_id" uuid NOT NULL REFERENCES "core"."object_metadata"("id") ON DELETE CASCADE,
        "name" varchar NOT NULL,
        "label" varchar NOT NULL,
        "type" varchar NOT NULL,
        "description" varchar,
        "icon" varchar,
        "is_custom" boolean NOT NULL DEFAULT true,
        "is_active" boolean NOT NULL DEFAULT true,
        "is_system" boolean NOT NULL DEFAULT false,
        "is_nullable" boolean NOT NULL DEFAULT true,
        "is_unique" boolean NOT NULL DEFAULT false,
        "is_restrictable" boolean NOT NULL DEFAULT true,
        "default_value" jsonb,
        "settings" jsonb,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        UNIQUE ("workspace_id", "object_metadata_id", "name")
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "core"."object_permissions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "role_id" uuid NOT NULL REFERENCES "core"."roles"("id") ON DELETE CASCADE,
        "object_metadata_id" uuid NOT NULL REFERENCES "core"."object_metadata"("id") ON DELETE CASCADE,
        "can_read" boolean,
        "can_update" boolean,
        "can_soft_delete" boolean,
        "can_destroy" boolean,
        UNIQUE ("role_id", "object_metadata_id")
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "core"."field_permissions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "role_id" uuid NOT NULL REFERENCES "core"."roles"("id") ON DELETE CASCADE,
        "field_metadata_id" uuid NOT NULL REFERENCES "core"."field_metadata"("id") ON DELETE CASCADE,
        "can_read" boolean,
        "can_update" boolean,
        UNIQUE ("role_id", "field_metadata_id")
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "core"."index_metadata" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "workspace_id" uuid NOT NULL REFERENCES "core"."workspaces"("id") ON DELETE CASCADE,
        "object_metadata_id" uuid NOT NULL REFERENCES "core"."object_metadata"("id") ON DELETE CASCADE,
        "name" varchar NOT NULL,
        "is_unique" boolean NOT NULL DEFAULT false,
        "column_names" jsonb NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "core"."views" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "workspace_id" uuid NOT NULL REFERENCES "core"."workspaces"("id") ON DELETE CASCADE,
        "object_metadata_id" uuid NOT NULL REFERENCES "core"."object_metadata"("id") ON DELETE CASCADE,
        "name" varchar NOT NULL,
        "type" varchar NOT NULL DEFAULT 'TABLE',
        "icon" varchar,
        "position" int NOT NULL DEFAULT 0,
        "is_compact" boolean NOT NULL DEFAULT false,
        "kanban_field_metadata_id" uuid,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "core"."view_fields" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "view_id" uuid NOT NULL REFERENCES "core"."views"("id") ON DELETE CASCADE,
        "field_metadata_id" uuid NOT NULL REFERENCES "core"."field_metadata"("id") ON DELETE CASCADE,
        "position" int NOT NULL DEFAULT 0,
        "is_visible" boolean NOT NULL DEFAULT true,
        "size" int NOT NULL DEFAULT 150,
        UNIQUE ("view_id", "field_metadata_id")
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "core"."view_filters" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "view_id" uuid NOT NULL REFERENCES "core"."views"("id") ON DELETE CASCADE,
        "field_metadata_id" uuid NOT NULL REFERENCES "core"."field_metadata"("id") ON DELETE CASCADE,
        "operand" varchar NOT NULL,
        "value" jsonb,
        "position" int NOT NULL DEFAULT 0
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "core"."view_sorts" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "view_id" uuid NOT NULL REFERENCES "core"."views"("id") ON DELETE CASCADE,
        "field_metadata_id" uuid NOT NULL REFERENCES "core"."field_metadata"("id") ON DELETE CASCADE,
        "direction" varchar NOT NULL DEFAULT 'ASC',
        UNIQUE ("view_id", "field_metadata_id")
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "core"."view_groups" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "view_id" uuid NOT NULL REFERENCES "core"."views"("id") ON DELETE CASCADE,
        "field_metadata_id" uuid NOT NULL REFERENCES "core"."field_metadata"("id") ON DELETE CASCADE,
        "field_value" varchar NOT NULL,
        "is_visible" boolean NOT NULL DEFAULT true,
        "position" int NOT NULL DEFAULT 0
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "core"."favorites" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "workspace_member_id" uuid NOT NULL REFERENCES "core"."workspace_members"("id") ON DELETE CASCADE,
        "object_metadata_id" uuid NOT NULL REFERENCES "core"."object_metadata"("id") ON DELETE CASCADE,
        "record_id" uuid NOT NULL,
        "position" int NOT NULL DEFAULT 0,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        UNIQUE ("workspace_member_id", "object_metadata_id", "record_id")
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "core"."api_keys" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "workspace_id" uuid NOT NULL REFERENCES "core"."workspaces"("id") ON DELETE CASCADE,
        "name" varchar NOT NULL,
        "role_id" uuid REFERENCES "core"."roles"("id") ON DELETE SET NULL,
        "token_hash" varchar NOT NULL,
        "revoked_at" timestamptz,
        "expires_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "core"."webhooks" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "workspace_id" uuid NOT NULL REFERENCES "core"."workspaces"("id") ON DELETE CASCADE,
        "target_url" varchar NOT NULL,
        "operations" jsonb NOT NULL DEFAULT '["*.*"]',
        "secret" varchar,
        "description" varchar,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "core"."refresh_tokens" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL REFERENCES "core"."users"("id") ON DELETE CASCADE,
        "token_hash" varchar NOT NULL,
        "expires_at" timestamptz NOT NULL,
        "revoked_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "core"."two_factor_methods" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL REFERENCES "core"."users"("id") ON DELETE CASCADE,
        "strategy" varchar NOT NULL DEFAULT 'TOTP',
        "secret_ciphertext" varchar NOT NULL,
        "status" varchar NOT NULL DEFAULT 'PENDING',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "core"."files" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "workspace_id" uuid NOT NULL REFERENCES "core"."workspaces"("id") ON DELETE CASCADE,
        "path" varchar NOT NULL,
        "name" varchar NOT NULL,
        "mime_type" varchar,
        "size" int,
        "created_at" timestamptz NOT NULL DEFAULT now()
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const tables = [
      'files',
      'two_factor_methods',
      'refresh_tokens',
      'webhooks',
      'api_keys',
      'favorites',
      'view_groups',
      'view_sorts',
      'view_filters',
      'view_fields',
      'views',
      'index_metadata',
      'field_permissions',
      'object_permissions',
      'field_metadata',
      'object_metadata',
      'invitations',
      'workspace_members',
      'user_workspaces',
      'role_permission_flags',
      'roles',
      'workspace_metadata_versions',
      'workspaces',
      'users',
    ];
    for (const table of tables) {
      await queryRunner.query(`DROP TABLE IF EXISTS "core"."${table}" CASCADE;`);
    }
  }
}
