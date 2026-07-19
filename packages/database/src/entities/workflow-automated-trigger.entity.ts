import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Registration row for an automatic trigger, written on workflow activation. The record-event listener
 * queries these by `settings->>'eventName'`; the cron scheduler reads the cron pattern. MANUAL and
 * WEBHOOK triggers register nothing (they're invoked on demand). Removed on deactivation.
 */
@Entity({ name: 'workflow_automated_triggers' })
export class WorkflowAutomatedTriggerEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'workspace_id' })
  workspaceId!: string;

  @Column({ type: 'uuid', name: 'workflow_id' })
  workflowId!: string;

  /** DATABASE_EVENT | CRON. */
  @Column({ type: 'varchar' })
  type!: string;

  /** `{ eventName, filter?, fields? }` for DATABASE_EVENT, or `{ pattern }` for CRON. */
  @Column({ type: 'jsonb', default: () => `'{}'` })
  settings!: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
