import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/**
 * A customizable page layout — a record page for an object, or (Phase 7) a dashboard. `type =
 * RECORD_PAGE` layouts are one-per-(workspace,object) — enforced by a partial unique index in the
 * migration (`WHERE type = 'RECORD_PAGE'`), since a TypeORM `@Index` can't express a partial index.
 * `type = DASHBOARD` layouts have no single object (`objectMetadataId` is null) and many can exist
 * per workspace. The layout owns ordered tabs → widgets; the FIELDS widget's field groups are
 * `page_layout_sections` rows pointed back via `page_layout_widget_id`.
 */
export const PageLayoutType = {
  RECORD_PAGE: 'RECORD_PAGE',
  DASHBOARD: 'DASHBOARD',
} as const;
export type PageLayoutType = (typeof PageLayoutType)[keyof typeof PageLayoutType];

@Entity({ name: 'page_layouts' })
export class PageLayoutEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'workspace_id' })
  workspaceId!: string;

  @Column({ type: 'uuid', name: 'object_metadata_id', nullable: true })
  objectMetadataId!: string | null;

  @Column({ type: 'varchar', default: PageLayoutType.RECORD_PAGE })
  type!: PageLayoutType;

  @Column({ type: 'varchar' })
  name!: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
