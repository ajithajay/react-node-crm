import { Column, CreateDateColumn, DeleteDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export const ConnectedAccountProvider = {
  GOOGLE: 'GOOGLE',
  MICROSOFT: 'MICROSOFT',
  IMAP_SMTP_CALDAV: 'IMAP_SMTP_CALDAV',
} as const;
export type ConnectedAccountProvider =
  (typeof ConnectedAccountProvider)[keyof typeof ConnectedAccountProvider];

export const ConnectedAccountAuthStatus = {
  PENDING: 'PENDING',
  CONNECTED: 'CONNECTED',
  FAILED: 'FAILED',
} as const;
export type ConnectedAccountAuthStatus =
  (typeof ConnectedAccountAuthStatus)[keyof typeof ConnectedAccountAuthStatus];

/**
 * IMAP/SMTP/CalDAV connection parameters for custom (non-OAuth) accounts.
 * `passwordCiphertext` is already encrypted via `encryptSecret` before being stored in the jsonb.
 */
export interface ImapSmtpCaldavParams {
  imapHost?: string;
  imapPort?: number;
  imapSecure?: boolean;
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure?: boolean;
  caldavUrl?: string;
  username?: string;
  passwordCiphertext?: string;
}

/**
 * A mailbox/calendar account a workspace member has connected (Google OAuth, Microsoft OAuth, or
 * IMAP/SMTP/CalDAV). Control-plane config: holds encrypted tokens/credentials and is read by the
 * sync worker without the metadata engine. Multiple rows per member = multiple mailboxes.
 */
@Entity({ name: 'connected_accounts' })
@Index('IDX_connected_accounts_ws_member', ['workspaceId', 'workspaceMemberId'])
export class ConnectedAccountEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'workspace_id' })
  workspaceId!: string;

  @Column({ type: 'uuid', name: 'workspace_member_id' })
  workspaceMemberId!: string;

  @Column({ type: 'varchar' })
  provider!: ConnectedAccountProvider;

  /** The account's email address. */
  @Column({ type: 'varchar' })
  handle!: string;

  /** Other email aliases owned by this account. */
  @Column({ type: 'jsonb', name: 'handle_aliases', default: () => `'[]'` })
  handleAliases!: string[];

  @Column({ type: 'varchar', name: 'access_token_ciphertext', nullable: true })
  accessTokenCiphertext!: string | null;

  @Column({ type: 'varchar', name: 'refresh_token_ciphertext', nullable: true })
  refreshTokenCiphertext!: string | null;

  @Column({ type: 'timestamptz', name: 'token_expires_at', nullable: true })
  tokenExpiresAt!: Date | null;

  @Column({ type: 'jsonb', default: () => `'[]'` })
  scopes!: string[];

  @Column({ type: 'jsonb', name: 'connection_parameters', nullable: true })
  connectionParameters!: ImapSmtpCaldavParams | null;

  @Column({ type: 'varchar', name: 'auth_status', default: ConnectedAccountAuthStatus.PENDING })
  authStatus!: ConnectedAccountAuthStatus;

  @Column({ type: 'timestamptz', name: 'auth_failed_at', nullable: true })
  authFailedAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ type: 'timestamptz', name: 'deleted_at' })
  deletedAt!: Date | null;
}
