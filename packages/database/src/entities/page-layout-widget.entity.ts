import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/**
 * A widget within a page-layout tab (Twenty's `pageLayoutWidget`). FIELDS renders the object's
 * field groups (`page_layout_sections` pointing back at this widget); TIMELINE/NOTES/TASKS/FILES
 * render the record's activity relations and carry no extra config (parity with Twenty, whose
 * timeline/notes/tasks/files widget configs are empty). `position` orders widgets within a tab.
 */
export const PageLayoutWidgetType = {
  FIELDS: 'FIELDS',
  TIMELINE: 'TIMELINE',
  NOTES: 'NOTES',
  TASKS: 'TASKS',
  FILES: 'FILES',
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

  @Column({ type: 'double precision', default: 0 })
  position!: number;

  @Column({ type: 'boolean', name: 'is_visible', default: true })
  isVisible!: boolean;

  @Column({ type: 'jsonb', default: () => `'{}'` })
  configuration!: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
