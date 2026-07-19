import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * A snapshot of a workflow's flow. `trigger` + `steps` are the DAG (JSON). Editing an ACTIVE workflow
 * forks a new DRAFT version; activating promotes DRAFT → ACTIVE and archives the previous ACTIVE.
 */
@Entity({ name: 'workflow_versions' })
export class WorkflowVersionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'workspace_id' })
  workspaceId!: string;

  @Column({ type: 'uuid', name: 'workflow_id' })
  workflowId!: string;

  @Column({ type: 'varchar' })
  name!: string;

  @Column({ type: 'varchar', default: 'DRAFT' })
  status!: string;

  /** The trigger object (root of the graph), or null on a fresh draft. */
  @Column({ type: 'jsonb', nullable: true })
  trigger!: Record<string, unknown> | null;

  /** Flat array of step nodes; edges are expressed via each node's `nextStepIds`. */
  @Column({ type: 'jsonb', default: () => `'[]'` })
  steps!: Record<string, unknown>[];

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
