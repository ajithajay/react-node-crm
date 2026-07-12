import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/**
 * A named field section on an object's record page (Twenty's page-layout / field-widget-group).
 * Ordered per object; `fieldMetadataIds` lists which fields render in the section, in order. Fields
 * not in any section fall into an implicit trailing bucket at render time. Kept as its own subsystem
 * (not a label on `field_metadata`) so grouping/ordering is independent of the field itself.
 */
@Entity({ name: 'page_layout_sections' })
@Index('IDX_page_layout_sections_object', ['workspaceId', 'objectMetadataId'])
export class PageLayoutSectionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'workspace_id' })
  workspaceId!: string;

  @Column({ type: 'uuid', name: 'object_metadata_id' })
  objectMetadataId!: string;

  /** The FIELDS widget this group belongs to (Phase 9 page-layout subsystem). Null for legacy rows
   * seeded before the widget layer existed; the page-layout GET migrates them under the widget. */
  @Column({ type: 'uuid', name: 'page_layout_widget_id', nullable: true })
  pageLayoutWidgetId!: string | null;

  @Column({ type: 'varchar' })
  label!: string;

  @Column({ type: 'int', default: 0 })
  position!: number;

  @Column({ type: 'boolean', name: 'is_visible', default: true })
  isVisible!: boolean;

  @Column({ type: 'jsonb', name: 'field_metadata_ids', default: () => `'[]'` })
  fieldMetadataIds!: string[];

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
