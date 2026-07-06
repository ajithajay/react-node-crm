import { Column, CreateDateColumn, Entity, Index, PrimaryColumn, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export const WorkspaceActivationStatus = {
  PENDING_CREATION: 'PENDING_CREATION',
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
} as const;
export type WorkspaceActivationStatus =
  (typeof WorkspaceActivationStatus)[keyof typeof WorkspaceActivationStatus];

@Entity({ name: 'workspaces' })
export class WorkspaceEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar' })
  name!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar' })
  subdomain!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', name: 'custom_domain', nullable: true })
  customDomain!: string | null;

  @Column({ type: 'varchar', name: 'logo_url', nullable: true })
  logoUrl!: string | null;

  /** Resolved by getWorkspaceSchemaName(id); persisted for quick lookup / debugging. */
  @Column({ type: 'varchar', name: 'database_schema' })
  databaseSchema!: string;

  @Column({
    type: 'varchar',
    name: 'activation_status',
    default: WorkspaceActivationStatus.PENDING_CREATION,
  })
  activationStatus!: WorkspaceActivationStatus;

  /** No FK constraint (avoids a circular workspaces<->roles dependency); enforced in app code. */
  @Column({ type: 'uuid', name: 'default_role_id', nullable: true })
  defaultRoleId!: string | null;

  @Column({ type: 'boolean', name: 'is_two_factor_authentication_enforced', default: false })
  isTwoFactorAuthenticationEnforced!: boolean;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}

/** One row per workspace; bumped on every metadata mutation to invalidate caches. */
@Entity({ name: 'workspace_metadata_versions' })
export class WorkspaceMetadataVersionEntity {
  @PrimaryColumn({ type: 'uuid', name: 'workspace_id' })
  workspaceId!: string;

  @Column({ type: 'int', default: 1 })
  version!: number;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
