import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/**
 * A widget within a page-layout tab. FIELDS renders the object's
 * field groups (`page_layout_sections` pointing back at this widget); TIMELINE/NOTES/TASKS/FILES
 * render the record's activity relations and carry no extra config (their
 * timeline/notes/tasks/files widget configs are always empty). GRAPH/IFRAME/RECORD_TABLE/
 * STANDALONE_RICH_TEXT (Phase 7 Dashboards) read `objectMetadataId` (the source object, nullable —
 * IFRAME/STANDALONE_RICH_TEXT have none) and use the `grid_*` columns for their dashboard-grid
 * position/size instead of the record-page `position` float.
 */
export const PageLayoutWidgetType = {
  FIELDS: 'FIELDS',
  FIELD: 'FIELD',
  TIMELINE: 'TIMELINE',
  NOTES: 'NOTES',
  TASKS: 'TASKS',
  FILES: 'FILES',
  EMAILS: 'EMAILS',
  CALENDAR: 'CALENDAR',
  GRAPH: 'GRAPH',
  IFRAME: 'IFRAME',
  RECORD_TABLE: 'RECORD_TABLE',
  STANDALONE_RICH_TEXT: 'STANDALONE_RICH_TEXT',
} as const;
export type PageLayoutWidgetType = (typeof PageLayoutWidgetType)[keyof typeof PageLayoutWidgetType];

@Entity({ name: 'page_layout_widgets' })
@Index('IDX_page_layout_widgets_tab', ['pageLayoutTabId'])
export class PageLayoutWidgetEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'workspace_id' })
  workspaceId!: string;

  @Column({ type: 'uuid', name: 'page_layout_tab_id' })
  pageLayoutTabId!: string;

  @Column({ type: 'varchar' })
  type!: PageLayoutWidgetType;

  @Column({ type: 'varchar' })
  title!: string;

  @Column({ type: 'uuid', name: 'object_metadata_id', nullable: true })
  objectMetadataId!: string | null;

  @Column({ type: 'double precision', default: 0 })
  position!: number;

  @Column({ type: 'int', name: 'grid_row', default: 0 })
  gridRow!: number;

  @Column({ type: 'int', name: 'grid_column', default: 0 })
  gridColumn!: number;

  @Column({ type: 'int', name: 'grid_row_span', default: 1 })
  gridRowSpan!: number;

  @Column({ type: 'int', name: 'grid_column_span', default: 1 })
  gridColumnSpan!: number;

  @Column({ type: 'boolean', name: 'is_visible', default: true })
  isVisible!: boolean;

  @Column({ type: 'jsonb', default: () => `'{}'` })
  configuration!: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
