import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Settings → Layout full customization (Phase 9 epic): the page-layout subsystem. Adds the
 * `page_layouts` → `page_layout_tabs` → `page_layout_widgets` hierarchy (Twenty parity) and links
 * the existing `page_layout_sections` (FIELDS field groups) back to a widget, plus a per-group
 * visibility flag. Additive — no reset needed; existing workspaces get a default layout synthesized
 * lazily on first read.
 */
export class AddPageLayouts1700000000006 implements MigrationInterface {
  name = 'AddPageLayouts1700000000006';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "core"."page_layouts" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "workspace_id" uuid NOT NULL REFERENCES "core"."workspaces"("id") ON DELETE CASCADE,
        "object_metadata_id" uuid NOT NULL REFERENCES "core"."object_metadata"("id") ON DELETE CASCADE,
        "type" varchar NOT NULL DEFAULT 'RECORD_PAGE',
        "name" varchar NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      );
      CREATE UNIQUE INDEX "IDX_page_layouts_object" ON "core"."page_layouts" ("workspace_id", "object_metadata_id", "type");

      CREATE TABLE "core"."page_layout_tabs" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "workspace_id" uuid NOT NULL REFERENCES "core"."workspaces"("id") ON DELETE CASCADE,
        "page_layout_id" uuid NOT NULL REFERENCES "core"."page_layouts"("id") ON DELETE CASCADE,
        "title" varchar NOT NULL,
        "icon" varchar,
        "position" double precision NOT NULL DEFAULT 0,
        "is_visible" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX "IDX_page_layout_tabs_layout" ON "core"."page_layout_tabs" ("page_layout_id");

      CREATE TABLE "core"."page_layout_widgets" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "workspace_id" uuid NOT NULL REFERENCES "core"."workspaces"("id") ON DELETE CASCADE,
        "page_layout_tab_id" uuid NOT NULL REFERENCES "core"."page_layout_tabs"("id") ON DELETE CASCADE,
        "type" varchar NOT NULL,
        "title" varchar NOT NULL,
        "position" double precision NOT NULL DEFAULT 0,
        "is_visible" boolean NOT NULL DEFAULT true,
        "configuration" jsonb NOT NULL DEFAULT '{}',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX "IDX_page_layout_widgets_tab" ON "core"."page_layout_widgets" ("page_layout_tab_id");

      ALTER TABLE "core"."page_layout_sections"
        ADD COLUMN "page_layout_widget_id" uuid REFERENCES "core"."page_layout_widgets"("id") ON DELETE CASCADE,
        ADD COLUMN "is_visible" boolean NOT NULL DEFAULT true;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "core"."page_layout_sections" DROP COLUMN IF EXISTS "page_layout_widget_id";
      ALTER TABLE "core"."page_layout_sections" DROP COLUMN IF EXISTS "is_visible";
      DROP TABLE IF EXISTS "core"."page_layout_widgets" CASCADE;
      DROP TABLE IF EXISTS "core"."page_layout_tabs" CASCADE;
      DROP TABLE IF EXISTS "core"."page_layouts" CASCADE;
    `);
  }
}
