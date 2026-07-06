import { Column, CreateDateColumn, DeleteDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'webhooks' })
export class WebhookEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'workspace_id' })
  workspaceId!: string;

  @Column({ type: 'varchar', name: 'target_url' })
  targetUrl!: string;

  /** Operation patterns, e.g. `["*.*"]` or `["company.created"]`. */
  @Column({ type: 'jsonb', default: () => `'["*.*"]'` })
  operations!: string[];

  @Column({ type: 'varchar', nullable: true })
  secret!: string | null;

  @Column({ type: 'varchar', nullable: true })
  description!: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @DeleteDateColumn({ type: 'timestamptz', name: 'deleted_at' })
  deletedAt!: Date | null;
}
