import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/**
 * A folder/label within a message channel (IMAP folder or Gmail label). `isSynced` is the
 * per-folder selection toggle; Spam/Trash are seeded with `isSynced=false`.
 */
@Entity({ name: 'message_folders' })
@Index('IDX_message_folders_channel', ['messageChannelId'])
export class MessageFolderEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'workspace_id' })
  workspaceId!: string;

  @Column({ type: 'uuid', name: 'message_channel_id' })
  messageChannelId!: string;

  @Column({ type: 'varchar' })
  name!: string;

  /** Gmail label id or IMAP folder path. */
  @Column({ type: 'varchar', name: 'external_id', nullable: true })
  externalId!: string | null;

  @Column({ type: 'boolean', name: 'is_sent_folder', default: false })
  isSentFolder!: boolean;

  @Column({ type: 'boolean', name: 'is_synced', default: true })
  isSynced!: boolean;

  /** IMAP per-folder cursor `UIDVALIDITY:UIDNEXT`. */
  @Column({ type: 'varchar', name: 'sync_cursor', nullable: true })
  syncCursor!: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
