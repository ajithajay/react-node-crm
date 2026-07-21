/** The two phases of the channel sync pipeline. */
export type ChannelSyncPhase = 'LIST_FETCH' | 'IMPORT';

/** One sync tick for a message or calendar channel (producer: api, consumer: worker). */
export interface ChannelSyncJobData {
  workspaceId: string;
  channelId: string;
  phase: ChannelSyncPhase;
}

/** An outbound email to send through a connected account (producer: api, consumer: worker). */
export interface MessageSendJobData {
  workspaceId: string;
  connectedAccountId: string;
  messageChannelId: string;
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  body: string;
  /** Header Message-ID being replied to, if this is a reply. */
  inReplyToHeaderMessageId: string | null;
  /** The thread record (workspace object) to attach the sent message to, if replying. */
  messageThreadId: string | null;
}

export const MESSAGING_SYNC_JOB_NAME = 'messaging-sync' as const;
export const CALENDAR_SYNC_JOB_NAME = 'calendar-sync' as const;
export const MESSAGING_SEND_JOB_NAME = 'messaging-send' as const;
