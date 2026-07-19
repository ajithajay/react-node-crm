import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** A workflow container (Phase 8). Holds many versions; `lastPublishedVersionId` marks the live one. */
@Entity({ name: 'workflows' })
export class WorkflowEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'workspace_id' })
  workspaceId!: string;

  @Column({ type: 'varchar' })
  name!: string;

  /** Aggregate of the version statuses present, e.g. `["ACTIVE","DRAFT"]` — drives the list badge. */
  @Column({ type: 'jsonb', default: () => `'[]'` })
  statuses!: string[];

  @Column({ type: 'uuid', name: 'last_published_version_id', nullable: true })
  lastPublishedVersionId!: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ type: 'timestamptz', name: 'deleted_at' })
  deletedAt!: Date | null;
}
