import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export const MessageChannelSyncStatus = {
  NOT_SYNCED: 'NOT_SYNCED',
  ONGOING: 'ONGOING',
  ACTIVE: 'ACTIVE',
  FAILED: 'FAILED',
} as const;
export type MessageChannelSyncStatus =
  (typeof MessageChannelSyncStatus)[keyof typeof MessageChannelSyncStatus];

export const MessageChannelSyncStage = {
  FULL_MESSAGE_LIST_FETCH_PENDING: 'FULL_MESSAGE_LIST_FETCH_PENDING',
  PARTIAL_MESSAGE_LIST_FETCH_PENDING: 'PARTIAL_MESSAGE_LIST_FETCH_PENDING',
  MESSAGES_IMPORT_PENDING: 'MESSAGES_IMPORT_PENDING',
  IDLE: 'IDLE',
} as const;
export type MessageChannelSyncStage =
  (typeof MessageChannelSyncStage)[keyof typeof MessageChannelSyncStage];

/** How much of a synced email is shared with the rest of the workspace. */
export const MessageChannelVisibility = {
  METADATA: 'METADATA',
  SUBJECT: 'SUBJECT',
  SHARE_EVERYTHING: 'SHARE_EVERYTHING',
} as const;
export type MessageChannelVisibility =
  (typeof MessageChannelVisibility)[keyof typeof MessageChannelVisibility];

export const ContactAutoCreationPolicy = {
  NONE: 'NONE',
  SENT: 'SENT',
  SENT_AND_RECEIVED: 'SENT_AND_RECEIVED',
} as const;
export type ContactAutoCreationPolicy =
  (typeof ContactAutoCreationPolicy)[keyof typeof ContactAutoCreationPolicy];

/**
 * An email channel bound to a connected account. Holds the email sync configuration and cursor
 * state driving the two-phase (list-fetch → import) sync pipeline.
 */
@Entity({ name: 'message_channels' })
@Index('IDX_message_channels_account', ['connectedAccountId'])
export class MessageChannelEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'workspace_id' })
  workspaceId!: string;

  @Column({ type: 'uuid', name: 'connected_account_id' })
  connectedAccountId!: string;

  @Column({ type: 'varchar' })
  handle!: string;

  @Column({ type: 'varchar', default: 'EMAIL' })
  type!: string;

  @Column({ type: 'boolean', name: 'is_sync_enabled', default: true })
  isSyncEnabled!: boolean;

  @Column({ type: 'varchar', name: 'sync_cursor', nullable: true })
  syncCursor!: string | null;

  @Column({ type: 'varchar', name: 'sync_status', default: MessageChannelSyncStatus.NOT_SYNCED })
  syncStatus!: MessageChannelSyncStatus;

  @Column({ type: 'varchar', name: 'sync_stage', default: MessageChannelSyncStage.FULL_MESSAGE_LIST_FETCH_PENDING })
  syncStage!: MessageChannelSyncStage;

  @Column({ type: 'timestamptz', name: 'sync_stage_started_at', nullable: true })
  syncStageStartedAt!: Date | null;

  @Column({ type: 'timestamptz', name: 'last_synced_at', nullable: true })
  lastSyncedAt!: Date | null;

  @Column({ type: 'int', name: 'throttle_failure_count', default: 0 })
  throttleFailureCount!: number;

  @Column({ type: 'varchar', default: MessageChannelVisibility.SHARE_EVERYTHING })
  visibility!: MessageChannelVisibility;

  @Column({ type: 'boolean', name: 'is_contact_auto_creation_enabled', default: true })
  isContactAutoCreationEnabled!: boolean;

  @Column({ type: 'varchar', name: 'contact_auto_creation_policy', default: ContactAutoCreationPolicy.SENT })
  contactAutoCreationPolicy!: ContactAutoCreationPolicy;

  @Column({ type: 'boolean', name: 'exclude_group_emails', default: true })
  excludeGroupEmails!: boolean;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
