import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * One execution of a workflow version. `state` snapshots the version's flow at creation time (so later
 * edits don't affect in-flight runs) and tracks per-step status/results (`state.stepInfos`) — the
 * source of the run-context used for `{{...}}` variable resolution.
 */
@Entity({ name: 'workflow_runs' })
export class WorkflowRunEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'workspace_id' })
  workspaceId!: string;

  @Column({ type: 'uuid', name: 'workflow_id' })
  workflowId!: string;

  @Column({ type: 'uuid', name: 'workflow_version_id' })
  workflowVersionId!: string;

  @Column({ type: 'varchar', default: 'NOT_STARTED' })
  status!: string;

  /** `{ flow: { trigger, steps }, stepInfos: { [stepId]: { status, result, error } }, workflowRunError? }`. */
  @Column({ type: 'jsonb', default: () => `'{}'` })
  state!: Record<string, unknown>;

  @Column({ type: 'uuid', name: 'created_by', nullable: true })
  createdBy!: string | null;

  @Column({ type: 'timestamptz', name: 'enqueued_at', nullable: true })
  enqueuedAt!: Date | null;

  @Column({ type: 'timestamptz', name: 'started_at', nullable: true })
  startedAt!: Date | null;

  @Column({ type: 'timestamptz', name: 'ended_at', nullable: true })
  endedAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
