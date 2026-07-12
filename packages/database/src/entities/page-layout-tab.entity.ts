import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/**
 * An ordered tab on a record page (Twenty's `pageLayoutTab`) — e.g. Home / Timeline / Notes /
 * Tasks / Files. `position` orders tabs; `isVisible` hides a tab without deleting it. Each tab owns
 * ordered widgets.
 */
@Entity({ name: 'page_layout_tabs' })
@Index('IDX_page_layout_tabs_layout', ['pageLayoutId'])
export class PageLayoutTabEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'workspace_id' })
  workspaceId!: string;

  @Column({ type: 'uuid', name: 'page_layout_id' })
  pageLayoutId!: string;

  @Column({ type: 'varchar' })
  title!: string;

  @Column({ type: 'varchar', nullable: true })
  icon!: string | null;

  @Column({ type: 'double precision', default: 0 })
  position!: number;

  @Column({ type: 'boolean', name: 'is_visible', default: true })
  isVisible!: boolean;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
