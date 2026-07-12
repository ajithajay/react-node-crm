import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/**
 * A customizable record page for an object (Twenty's `pageLayout`). One per (workspace, object,
 * type). `type` is RECORD_PAGE for now (Twenty also has RECORD_INDEX / DASHBOARD — deferred until
 * dashboards land). The layout owns ordered tabs → widgets; the FIELDS widget's field groups are
 * `page_layout_sections` rows pointed back via `page_layout_widget_id`.
 */
export const PageLayoutType = {
  RECORD_PAGE: 'RECORD_PAGE',
} as const;
export type PageLayoutType = (typeof PageLayoutType)[keyof typeof PageLayoutType];

@Entity({ name: 'page_layouts' })
@Index('IDX_page_layouts_object', ['workspaceId', 'objectMetadataId', 'type'], { unique: true })
export class PageLayoutEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'workspace_id' })
  workspaceId!: string;

  @Column({ type: 'uuid', name: 'object_metadata_id' })
  objectMetadataId!: string;

  @Column({ type: 'varchar', default: PageLayoutType.RECORD_PAGE })
  type!: PageLayoutType;

  @Column({ type: 'varchar' })
  name!: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
