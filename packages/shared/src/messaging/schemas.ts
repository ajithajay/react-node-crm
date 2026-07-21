import { z } from 'zod';

/** The record objects that can display an Emails/Calendar tab. */
export const TIMELINE_OBJECT_SINGULARS = ['person', 'company', 'opportunity'] as const;
export type TimelineObjectSingular = (typeof TIMELINE_OBJECT_SINGULARS)[number];

export const timelineThreadsQuerySchema = z.object({
  objectNameSingular: z.enum(TIMELINE_OBJECT_SINGULARS),
  recordId: z.string().uuid(),
  page: z.coerce.number().int().min(1).optional().default(1),
});
export type TimelineThreadsQuery = z.infer<typeof timelineThreadsQuerySchema>;

export interface ThreadParticipantDto {
  handle: string;
  displayName: string | null;
  role: string;
  personId: string | null;
}

export interface ThreadPreviewDto {
  id: string;
  subject: string;
  lastMessageAt: string | null;
  snippet: string;
  messageCount: number;
  participants: ThreadParticipantDto[];
  /** Which connected mailbox this thread was synced from. */
  sourceHandle: string | null;
}

export interface ThreadMessageDto {
  id: string;
  subject: string;
  text: string;
  receivedAt: string | null;
  direction: string;
  participants: ThreadParticipantDto[];
}

export interface ThreadDetailDto {
  id: string;
  subject: string;
  messages: ThreadMessageDto[];
}

export interface CalendarEventParticipantDto {
  handle: string;
  displayName: string | null;
  personId: string | null;
  responseStatus: string;
  isOrganizer: boolean;
}

export interface CalendarEventDto {
  id: string;
  title: string;
  description: string;
  location: string;
  startsAt: string | null;
  endsAt: string | null;
  isFullDay: boolean;
  isCanceled: boolean;
  conferenceLink: string | null;
  participants: CalendarEventParticipantDto[];
}

/** Compose or reply. `messageThreadId` present => reply in an existing thread. */
export const sendMessageRequestSchema = z.object({
  messageChannelId: z.string().uuid(),
  to: z.array(z.string().trim().email()).min(1),
  cc: z.array(z.string().trim().email()).default([]),
  bcc: z.array(z.string().trim().email()).default([]),
  subject: z.string().max(998).default(''),
  body: z.string().default(''),
  messageThreadId: z.string().uuid().nullish(),
  inReplyToHeaderMessageId: z.string().nullish(),
});
export type SendMessageRequest = z.infer<typeof sendMessageRequestSchema>;
