import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** Security-relevant event trail for Settings → General → Logs (BRD §7.1). */
@Entity({ name: 'audit_logs' })
@Index(['workspaceId', 'createdAt'])
export class AuditLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'workspace_id' })
  workspaceId!: string;

  /** Null for system-initiated events (none yet, but keeps the column honest). */
  @Column({ type: 'uuid', name: 'actor_user_id', nullable: true })
  actorUserId!: string | null;

  @Column({ type: 'varchar' })
  action!: string;

  @Column({ type: 'varchar', name: 'target_type', nullable: true })
  targetType!: string | null;

  @Column({ type: 'varchar', name: 'target_id', nullable: true })
  targetId!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
