import { z } from 'zod';

/** Providers a mailbox/calendar account can be connected through. */
export const CONNECTED_ACCOUNT_PROVIDERS = ['GOOGLE', 'MICROSOFT', 'IMAP_SMTP_CALDAV'] as const;
export type ConnectedAccountProviderValue = (typeof CONNECTED_ACCOUNT_PROVIDERS)[number];

export const MESSAGE_CHANNEL_VISIBILITIES = ['METADATA', 'SUBJECT', 'SHARE_EVERYTHING'] as const;
export type MessageChannelVisibilityValue = (typeof MESSAGE_CHANNEL_VISIBILITIES)[number];

export const CALENDAR_CHANNEL_VISIBILITIES = ['METADATA', 'SHARE_EVERYTHING'] as const;
export type CalendarChannelVisibilityValue = (typeof CALENDAR_CHANNEL_VISIBILITIES)[number];

export const CONTACT_AUTO_CREATION_POLICIES = ['NONE', 'SENT', 'SENT_AND_RECEIVED'] as const;
export type ContactAutoCreationPolicyValue = (typeof CONTACT_AUTO_CREATION_POLICIES)[number];

export const CHANNEL_SYNC_STATUSES = ['NOT_SYNCED', 'ONGOING', 'ACTIVE', 'FAILED'] as const;
export type ChannelSyncStatusValue = (typeof CHANNEL_SYNC_STATUSES)[number];

/** Save a custom (non-OAuth) IMAP/SMTP/CalDAV account. */
export const createImapSmtpAccountRequestSchema = z.object({
  handle: z.string().trim().email().max(320),
  imapHost: z.string().trim().min(1).max(255),
  imapPort: z.number().int().min(1).max(65535).default(993),
  imapSecure: z.boolean().default(true),
  smtpHost: z.string().trim().min(1).max(255),
  smtpPort: z.number().int().min(1).max(65535).default(465),
  smtpSecure: z.boolean().default(true),
  // Optional: a full URL when provided, or blank/omitted for no calendar sync.
  caldavUrl: z.string().trim().max(2000).url().or(z.literal('')).optional(),
  username: z.string().trim().min(1).max(320),
  password: z.string().min(1).max(1024),
});
export type CreateImapSmtpAccountRequest = z.infer<typeof createImapSmtpAccountRequestSchema>;

/** Edit an existing IMAP/SMTP/CalDAV account. Password omitted/blank = keep the current one. */
export const updateImapSmtpAccountRequestSchema = z.object({
  imapHost: z.string().trim().min(1).max(255),
  imapPort: z.number().int().min(1).max(65535),
  imapSecure: z.boolean(),
  smtpHost: z.string().trim().min(1).max(255),
  smtpPort: z.number().int().min(1).max(65535),
  smtpSecure: z.boolean(),
  caldavUrl: z.string().trim().max(2000).url().or(z.literal('')).optional(),
  username: z.string().trim().min(1).max(320),
  password: z.string().max(1024).optional(),
});
export type UpdateImapSmtpAccountRequest = z.infer<typeof updateImapSmtpAccountRequestSchema>;

export const updateMessageChannelRequestSchema = z.object({
  isSyncEnabled: z.boolean().optional(),
  visibility: z.enum(MESSAGE_CHANNEL_VISIBILITIES).optional(),
  isContactAutoCreationEnabled: z.boolean().optional(),
  contactAutoCreationPolicy: z.enum(CONTACT_AUTO_CREATION_POLICIES).optional(),
  excludeGroupEmails: z.boolean().optional(),
});
export type UpdateMessageChannelRequest = z.infer<typeof updateMessageChannelRequestSchema>;

export const updateCalendarChannelRequestSchema = z.object({
  isSyncEnabled: z.boolean().optional(),
  visibility: z.enum(CALENDAR_CHANNEL_VISIBILITIES).optional(),
  isContactAutoCreationEnabled: z.boolean().optional(),
});
export type UpdateCalendarChannelRequest = z.infer<typeof updateCalendarChannelRequestSchema>;

export const updateMessageFoldersRequestSchema = z.object({
  folders: z.array(z.object({ id: z.string().uuid(), isSynced: z.boolean() })).min(1),
});
export type UpdateMessageFoldersRequest = z.infer<typeof updateMessageFoldersRequestSchema>;

export interface MessageFolderSummary {
  id: string;
  name: string;
  isSentFolder: boolean;
  isSynced: boolean;
}

export interface MessageChannelSummary {
  id: string;
  handle: string;
  isSyncEnabled: boolean;
  syncStatus: ChannelSyncStatusValue;
  lastSyncedAt: string | null;
  visibility: MessageChannelVisibilityValue;
  isContactAutoCreationEnabled: boolean;
  contactAutoCreationPolicy: ContactAutoCreationPolicyValue;
  excludeGroupEmails: boolean;
  folders: MessageFolderSummary[];
}

export interface CalendarChannelSummary {
  id: string;
  handle: string;
  isSyncEnabled: boolean;
  syncStatus: ChannelSyncStatusValue;
  lastSyncedAt: string | null;
  visibility: CalendarChannelVisibilityValue;
  isContactAutoCreationEnabled: boolean;
}

/** Non-secret IMAP/SMTP/CalDAV connection params, for prefilling the edit form (never the password). */
export interface ImapSmtpParamsSummary {
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  caldavUrl: string;
  username: string;
}

export interface ConnectedAccountSummary {
  id: string;
  provider: ConnectedAccountProviderValue;
  handle: string;
  authStatus: 'PENDING' | 'CONNECTED' | 'FAILED';
  createdAt: string;
  messageChannel: MessageChannelSummary | null;
  calendarChannel: CalendarChannelSummary | null;
  /** Present only for IMAP_SMTP_CALDAV accounts. */
  imapSmtp: ImapSmtpParamsSummary | null;
}
