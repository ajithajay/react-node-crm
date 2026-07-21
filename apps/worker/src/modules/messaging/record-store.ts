import { ObjectMetadataEntity } from '@saasly/database';
import { dataSource, workspaceDataSourceCache } from '../../lib/db.js';
import type { ContactAutoCreationPolicy } from '@saasly/database';
import type { NormalizedEvent, NormalizedMessage } from './providers/types.js';

type Row = Record<string, unknown>;

async function repo(workspaceId: string, singular: string) {
  const ws = await workspaceDataSourceCache.getWorkspaceDataSource(workspaceId);
  return ws.getRepository<Row>(singular);
}

/** True if the object exists in this workspace (defensive against partially-provisioned workspaces). */
async function objectExists(workspaceId: string, singular: string): Promise<boolean> {
  const found = await dataSource
    .getRepository(ObjectMetadataEntity)
    .findOneBy({ workspaceId, nameSingular: singular });
  return !!found;
}

/** Match a Person by primary or additional email (case-insensitive). Returns the person id or null. */
export async function findPersonIdByEmail(workspaceId: string, email: string): Promise<string | null> {
  const personRepo = await repo(workspaceId, 'person');
  const normalized = email.toLowerCase();
  const row = await personRepo
    .createQueryBuilder('p')
    .select('p.id', 'id')
    .where('LOWER(p.emails_primary_email) = :email', { email: normalized })
    .orWhere('p.emails_additional_emails @> :json', { json: JSON.stringify([normalized]) })
    .limit(1)
    .getRawOne<{ id: string }>();
  return row?.id ?? null;
}

/** Match a workspace member (data-plane object) by email. Returns the member id or null. */
export async function findWorkspaceMemberIdByEmail(workspaceId: string, email: string): Promise<string | null> {
  const memberRepo = await repo(workspaceId, 'workspace_member');
  const row = await memberRepo
    .createQueryBuilder('m')
    .select('m.id', 'id')
    .where('LOWER(m.email) = :email', { email: email.toLowerCase() })
    .limit(1)
    .getRawOne<{ id: string }>();
  return row?.id ?? null;
}

/** Find a company whose domain matches the email domain; returns company id or null. */
async function findCompanyIdByDomain(workspaceId: string, domain: string): Promise<string | null> {
  const companyRepo = await repo(workspaceId, 'company');
  const row = await companyRepo
    .createQueryBuilder('c')
    .select('c.id', 'id')
    .where('LOWER(c.domain_name_primary_link_url) ILIKE :d', { d: `%${domain.toLowerCase()}%` })
    .limit(1)
    .getRawOne<{ id: string }>();
  return row?.id ?? null;
}

async function createCompanyForDomain(workspaceId: string, domain: string): Promise<string> {
  const companyRepo = await repo(workspaceId, 'company');
  const saved = (await companyRepo.save(
    companyRepo.create({
      name: domain,
      domain_name_primary_link_url: `https://${domain}`,
      domain_name_secondary_links: [],
    }),
  )) as Row;
  return saved.id as string;
}

/**
 * Create a Person from an email handle and link it to a Company by domain (creating the company if
 * missing). Returns the new person id.
 */
export async function createPersonFromHandle(
  workspaceId: string,
  handle: string,
  displayName: string | null,
): Promise<string | null> {
  if (!(await objectExists(workspaceId, 'person'))) return null;
  const personRepo = await repo(workspaceId, 'person');

  const localPart = handle.split('@')[0] ?? handle;
  const [first, ...rest] = (displayName ?? localPart).split(' ');
  const domain = handle.split('@')[1];
  let companyId: string | null = null;
  if (domain && (await objectExists(workspaceId, 'company'))) {
    companyId = (await findCompanyIdByDomain(workspaceId, domain)) ?? (await createCompanyForDomain(workspaceId, domain));
  }

  const saved = (await personRepo.save(
    personRepo.create({
      name_first_name: first || handle,
      name_last_name: rest.join(' '),
      emails_primary_email: handle.toLowerCase(),
      emails_additional_emails: [],
      ...(companyId ? { company_id: companyId } : {}),
    }),
  )) as Row;
  return saved.id as string;
}

/** Does the channel already have this external message? Keeps re-syncs idempotent. */
async function associationExists(
  workspaceId: string,
  messageChannelId: string,
  messageExternalId: string,
): Promise<boolean> {
  const assocRepo = await repo(workspaceId, 'message_channel_message_association');
  const found = await assocRepo
    .createQueryBuilder('a')
    .where('a.message_channel_id = :cid AND a.message_external_id = :eid', {
      cid: messageChannelId,
      eid: messageExternalId,
    })
    .getExists();
  return found;
}

/** Find (or create) the thread for a given external thread key within a channel. */
async function findOrCreateThread(
  workspaceId: string,
  messageChannelId: string,
  threadExternalId: string,
  subject: string,
): Promise<string> {
  const assocRepo = await repo(workspaceId, 'message_channel_message_association');
  const existing = await assocRepo
    .createQueryBuilder('a')
    .select('a.message_thread_id', 'tid')
    .where('a.message_channel_id = :cid AND a.message_thread_external_id = :tid', {
      cid: messageChannelId,
      tid: threadExternalId,
    })
    .andWhere('a.message_thread_id IS NOT NULL')
    .limit(1)
    .getRawOne<{ tid: string }>();
  if (existing?.tid) return existing.tid;

  const threadRepo = await repo(workspaceId, 'message_thread');
  const saved = (await threadRepo.save(threadRepo.create({}))) as Row;
  return saved.id as string;
}

export interface ParticipantResolution {
  personId: string | null;
  workspaceMemberId: string | null;
}

export interface StoreMessageInput {
  workspaceId: string;
  messageChannelId: string;
  message: NormalizedMessage;
  /** Resolved person/member ids per handle (lowercased). */
  resolutions: Map<string, ParticipantResolution>;
  /** Attach to this existing thread id instead of resolving by external key (used for replies). */
  forcedThreadId?: string;
}

/** Persist one normalized message + its thread, participants, and channel association. Idempotent. */
export async function storeMessage(input: StoreMessageInput): Promise<{ created: boolean; messageId: string | null; threadId: string }> {
  const { workspaceId, messageChannelId, message } = input;
  if (await associationExists(workspaceId, messageChannelId, message.externalId)) {
    return { created: false, messageId: null, threadId: input.forcedThreadId ?? '' };
  }

  const threadId =
    input.forcedThreadId ??
    (await findOrCreateThread(workspaceId, messageChannelId, message.threadExternalId, message.subject));

  const messageRepo = await repo(workspaceId, 'message');
  const savedMessage = (await messageRepo.save(
    messageRepo.create({
      subject: message.subject,
      text_markdown: message.text,
      text_blocknote: null,
      received_at: message.receivedAt,
      header_message_id: message.headerMessageId,
      message_thread_id: threadId,
    }),
  )) as Row;
  const messageId = savedMessage.id as string;

  const participantRepo = await repo(workspaceId, 'message_participant');
  for (const p of message.participants) {
    const res = input.resolutions.get(p.handle.toLowerCase()) ?? { personId: null, workspaceMemberId: null };
    await participantRepo.save(
      participantRepo.create({
        role: p.role,
        handle: p.handle,
        display_name: p.displayName,
        message_id: messageId,
        person_id: res.personId,
        workspace_member_id: res.workspaceMemberId,
      }),
    );
  }

  const assocRepo = await repo(workspaceId, 'message_channel_message_association');
  await assocRepo.save(
    assocRepo.create({
      message_external_id: message.externalId,
      message_thread_external_id: message.threadExternalId,
      direction: message.direction,
      message_channel_id: messageChannelId,
      message_id: messageId,
      message_thread_id: threadId,
    }),
  );

  return { created: true, messageId, threadId };
}

// ---- Calendar events ----

async function eventAssociationExists(
  workspaceId: string,
  calendarChannelId: string,
  eventExternalId: string,
): Promise<boolean> {
  const assocRepo = await repo(workspaceId, 'calendar_channel_event_association');
  return assocRepo
    .createQueryBuilder('a')
    .where('a.calendar_channel_id = :cid AND a.event_external_id = :eid', { cid: calendarChannelId, eid: eventExternalId })
    .getExists();
}

export interface StoreEventInput {
  workspaceId: string;
  calendarChannelId: string;
  event: NormalizedEvent;
  resolutions: Map<string, ParticipantResolution>;
}

/** Persist one calendar event + its participants and channel association. Idempotent per channel. */
export async function storeEvent(input: StoreEventInput): Promise<{ created: boolean }> {
  const { workspaceId, calendarChannelId, event } = input;
  if (await eventAssociationExists(workspaceId, calendarChannelId, event.externalId)) {
    return { created: false };
  }

  const eventRepo = await repo(workspaceId, 'calendar_event');
  const saved = (await eventRepo.save(
    eventRepo.create({
      title: event.title,
      description_markdown: event.description,
      description_blocknote: null,
      location: event.location,
      starts_at: event.startsAt,
      ends_at: event.endsAt,
      is_full_day: event.isFullDay,
      is_canceled: event.isCanceled,
      external_id: event.externalId,
      ical_uid: event.iCalUid,
      conference_link_primary_link_url: event.conferenceLink || null,
      conference_link_secondary_links: [],
    }),
  )) as Row;
  const eventId = saved.id as string;

  const participantRepo = await repo(workspaceId, 'calendar_event_participant');
  for (const p of event.participants) {
    const res = input.resolutions.get(p.handle.toLowerCase()) ?? { personId: null, workspaceMemberId: null };
    await participantRepo.save(
      participantRepo.create({
        handle: p.handle,
        display_name: p.displayName,
        response_status: p.responseStatus,
        is_organizer: p.isOrganizer,
        calendar_event_id: eventId,
        person_id: res.personId,
        workspace_member_id: res.workspaceMemberId,
      }),
    );
  }

  const assocRepo = await repo(workspaceId, 'calendar_channel_event_association');
  await assocRepo.save(
    assocRepo.create({
      event_external_id: event.externalId,
      calendar_channel_id: calendarChannelId,
      calendar_event_id: eventId,
    }),
  );

  return { created: true };
}

export type { ContactAutoCreationPolicy };
