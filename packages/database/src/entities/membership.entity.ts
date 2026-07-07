import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/** Auth-level membership: which users may access which workspace. */
@Entity({ name: 'user_workspaces' })
@Index(['userId', 'workspaceId'], { unique: true })
export class UserWorkspaceEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId!: string;

  @Column({ type: 'uuid', name: 'workspace_id' })
  workspaceId!: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}

export const ColorScheme = { LIGHT: 'LIGHT', DARK: 'DARK', SYSTEM: 'SYSTEM' } as const;
export type ColorScheme = (typeof ColorScheme)[keyof typeof ColorScheme];

/** The workspace-scoped profile: name, avatar, role assignment, preferences (BRD §6). */
@Entity({ name: 'workspace_members' })
@Index(['workspaceId', 'userId'], { unique: true })
export class WorkspaceMemberEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'workspace_id' })
  workspaceId!: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId!: string;

  @Column({ type: 'uuid', name: 'role_id', nullable: true })
  roleId!: string | null;

  @Column({ type: 'varchar', name: 'first_name', default: '' })
  firstName!: string;

  @Column({ type: 'varchar', name: 'last_name', default: '' })
  lastName!: string;

  @Column({ type: 'varchar', name: 'avatar_url', nullable: true })
  avatarUrl!: string | null;

  @Column({ type: 'varchar', name: 'color_scheme', default: ColorScheme.SYSTEM })
  colorScheme!: ColorScheme;

  @Column({ type: 'varchar', default: 'en' })
  locale!: string;

  @Column({ type: 'varchar', name: 'time_zone', default: 'UTC' })
  timeZone!: string;

  @Column({ type: 'varchar', name: 'date_format', default: 'MM/DD/YYYY' })
  dateFormat!: string;

  @Column({ type: 'varchar', name: 'time_format', default: 'HH:mm' })
  timeFormat!: string;

  @Column({ type: 'varchar', name: 'number_format', default: '1,000.00' })
  numberFormat!: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}

export const InvitationStatus = { PENDING: 'PENDING', ACCEPTED: 'ACCEPTED', REVOKED: 'REVOKED' } as const;
export type InvitationStatus = (typeof InvitationStatus)[keyof typeof InvitationStatus];

@Entity({ name: 'invitations' })
@Index(['workspaceId', 'email'], { unique: true })
export class InvitationEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'workspace_id' })
  workspaceId!: string;

  @Column({ type: 'varchar' })
  email!: string;

  @Column({ type: 'varchar', name: 'token_hash' })
  tokenHash!: string;

  @Column({ type: 'varchar', default: InvitationStatus.PENDING })
  status!: InvitationStatus;

  @Column({ type: 'uuid', name: 'invited_by_id', nullable: true })
  invitedById!: string | null;

  /** The role the invitee joins with. Null falls back to the workspace's default role. */
  @Column({ type: 'uuid', name: 'role_id', nullable: true })
  roleId!: string | null;

  @Column({ type: 'timestamptz', name: 'expires_at' })
  expiresAt!: Date;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
