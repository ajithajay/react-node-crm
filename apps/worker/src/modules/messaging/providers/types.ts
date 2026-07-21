import type { ConnectedAccountEntity, MessageChannelEntity, MessageFolderEntity } from '@saasly/database';

export type ParticipantRole = 'FROM' | 'TO' | 'CC' | 'BCC';
export type MessageDirection = 'INCOMING' | 'OUTGOING';

export interface NormalizedParticipant {
  role: ParticipantRole;
  handle: string;
  displayName: string | null;
}

/** A provider-agnostic email, ready to be persisted to the workspace schema. */
export interface NormalizedMessage {
  /** Provider-stable id (IMAP `folder:uid`, Gmail message id). Used for dedup per channel. */
  externalId: string;
  /** Groups messages into a thread (IMAP: normalized subject / references root; Gmail: threadId). */
  threadExternalId: string;
  headerMessageId: string;
  subject: string;
  text: string;
  receivedAt: Date;
  direction: MessageDirection;
  participants: NormalizedParticipant[];
}

export interface FetchResult {
  messages: NormalizedMessage[];
  /** Updated per-folder cursor to persist (IMAP `UIDVALIDITY:UIDNEXT`); null to leave unchanged. */
  folderCursors: Record<string, string>;
}

/**
 * A mail provider knows how to pull new messages for a channel. `fetchNewMessages` does a single
 * bounded pass (up to `maxMessages`), advancing folder cursors; the sync service loops/schedules it.
 */
export interface MailProvider {
  fetchNewMessages(
    account: ConnectedAccountEntity,
    channel: MessageChannelEntity,
    folders: MessageFolderEntity[],
    opts: { fullSync: boolean; maxMessages: number },
  ): Promise<FetchResult>;

  /** List the provider's folders/labels (for seeding `message_folders` on connect). */
  listFolders(account: ConnectedAccountEntity): Promise<{ name: string; externalId: string; isSentFolder: boolean }[]>;

  /** Send an outbound email; returns the provider message id. */
  sendMessage(
    account: ConnectedAccountEntity,
    message: { to: string[]; cc: string[]; bcc: string[]; subject: string; body: string; inReplyTo: string | null },
  ): Promise<{ externalId: string }>;
}

export type EventResponseStatus = 'NEEDS_ACTION' | 'DECLINED' | 'TENTATIVE' | 'ACCEPTED';

export interface NormalizedEventParticipant {
  handle: string;
  displayName: string | null;
  isOrganizer: boolean;
  responseStatus: EventResponseStatus;
}

/** A provider-agnostic calendar event, ready to persist. */
export interface NormalizedEvent {
  externalId: string;
  title: string;
  description: string;
  location: string;
  startsAt: Date | null;
  endsAt: Date | null;
  isFullDay: boolean;
  isCanceled: boolean;
  iCalUid: string;
  conferenceLink: string;
  participants: NormalizedEventParticipant[];
}

export interface CalendarFetchResult {
  events: NormalizedEvent[];
  /** Updated channel cursor (Google syncToken / CalDAV ctag); null to leave unchanged. */
  cursor: string | null;
}

/** A calendar provider pulls new/changed events for a channel. Read-only (no event creation). */
export interface CalendarProvider {
  fetchNewEvents(
    account: ConnectedAccountEntity,
    channel: import('@saasly/database').CalendarChannelEntity,
    opts: { fullSync: boolean; cursor: string | null; maxEvents: number },
  ): Promise<CalendarFetchResult>;
}
