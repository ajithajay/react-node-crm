import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { MessageChannelSyncStage, MessageChannelSyncStatus } from './message-channel.entity.js';

/** How much of a synced calendar event is shared with the rest of the workspace. */
export const CalendarChannelVisibility = {
  METADATA: 'METADATA',
  SHARE_EVERYTHING: 'SHARE_EVERYTHING',
} as const;
export type CalendarChannelVisibility =
  (typeof CalendarChannelVisibility)[keyof typeof CalendarChannelVisibility];

/**
 * A calendar channel bound to a connected account. Holds the read-only calendar sync configuration
 * and cursor state (Google syncToken / CalDAV ctag) driving the calendar sync pipeline.
 */
@Entity({ name: 'calendar_channels' })
@Index('IDX_calendar_channels_account', ['connectedAccountId'])
export class CalendarChannelEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'workspace_id' })
  workspaceId!: string;

  @Column({ type: 'uuid', name: 'connected_account_id' })
  connectedAccountId!: string;

  @Column({ type: 'varchar' })
  handle!: string;

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

  @Column({ type: 'varchar', default: CalendarChannelVisibility.SHARE_EVERYTHING })
  visibility!: CalendarChannelVisibility;

  @Column({ type: 'boolean', name: 'is_contact_auto_creation_enabled', default: true })
  isContactAutoCreationEnabled!: boolean;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
