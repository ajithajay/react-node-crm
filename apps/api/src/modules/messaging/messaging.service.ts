import { ConnectedAccountEntity, MessageChannelEntity } from '@saasly/database';
import type {
  SendMessageRequest,
  ThreadDetailDto,
  ThreadMessageDto,
  ThreadParticipantDto,
  ThreadPreviewDto,
  TimelineObjectSingular,
} from '@saasly/shared';
import { dataSource } from '../../lib/db.js';
import { NotFoundError } from '../../lib/errors.js';
import { enqueueMessageSend } from '../../lib/queue.js';
import { workspaceDataSourceCache } from '../../lib/workspace-data-source.js';

const PAGE_SIZE = 20;

type Row = Record<string, unknown>;

async function repo(workspaceId: string, singular: string) {
  const ws = await workspaceDataSourceCache.getWorkspaceDataSource(workspaceId);
  return ws.getRepository<Row>(singular);
}

function domainFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const match = /^(?:https?:\/\/)?([^/]+)/i.exec(url.trim());
  const host = match?.[1]?.toLowerCase();
  return host ? host.replace(/^www\./, '') : null;
}

interface Scope {
  personIds: string[];
  domain: string | null;
}

/** Resolve which people/domain a record's email/calendar timeline should be matched against. */
export async function resolveScope(
  workspaceId: string,
  objectNameSingular: TimelineObjectSingular,
  recordId: string,
): Promise<Scope> {
  if (objectNameSingular === 'person') {
    return { personIds: [recordId], domain: null };
  }

  let companyId: string | null = null;
  if (objectNameSingular === 'company') {
    companyId = recordId;
  } else {
    const oppRepo = await repo(workspaceId, 'opportunity');
    const opp = await oppRepo
      .createQueryBuilder('o')
      .select('o.company_id', 'cid')
      .where('o.id = :id', { id: recordId })
      .getRawOne<{ cid: string | null }>();
    companyId = opp?.cid ?? null;
  }
  if (!companyId) return { personIds: [], domain: null };

  const personRepo = await repo(workspaceId, 'person');
  const people = await personRepo
    .createQueryBuilder('p')
    .select('p.id', 'id')
    .where('p.company_id = :cid', { cid: companyId })
    .getRawMany<{ id: string }>();

  const companyRepo = await repo(workspaceId, 'company');
  const company = await companyRepo
    .createQueryBuilder('c')
    .select('c.domain_name_primary_link_url', 'url')
    .where('c.id = :id', { id: companyId })
    .getRawOne<{ url: string | null }>();

  return { personIds: people.map((p) => p.id), domain: domainFromUrl(company?.url) };
}

/** Distinct thread ids that involve any of the scope's people or domain. */
async function scopedThreadIds(workspaceId: string, scope: Scope): Promise<string[]> {
  if (scope.personIds.length === 0 && !scope.domain) return [];
  const participantRepo = await repo(workspaceId, 'message_participant');
  const qb = participantRepo
    .createQueryBuilder('mp')
    .innerJoin('message', 'm', 'm.id = mp.message_id')
    .select('DISTINCT m.message_thread_id', 'tid');

  const conditions: string[] = [];
  const params: Record<string, unknown> = {};
  if (scope.personIds.length > 0) {
    conditions.push('mp.person_id IN (:...personIds)');
    params.personIds = scope.personIds;
  }
  if (scope.domain) {
    conditions.push('LOWER(mp.handle) LIKE :domainLike');
    params.domainLike = `%@${scope.domain}`;
  }
  qb.where(`(${conditions.join(' OR ')})`, params).andWhere('m.message_thread_id IS NOT NULL');

  const rows = await qb.getRawMany<{ tid: string }>();
  return rows.map((r) => r.tid);
}

interface VisibilityInfo {
  visibility: string;
  handle: string;
}

/** Load core message-channel visibility + handle for the given channel ids. */
async function channelInfo(channelIds: string[]): Promise<Map<string, VisibilityInfo>> {
  const map = new Map<string, VisibilityInfo>();
  if (channelIds.length === 0) return map;
  const channels = await dataSource
    .getRepository(MessageChannelEntity)
    .createQueryBuilder('c')
    .where('c.id IN (:...ids)', { ids: channelIds })
    .getMany();
  for (const c of channels) map.set(c.id, { visibility: c.visibility, handle: c.handle });
  return map;
}

function mask(visibility: string | undefined, subject: string, text: string): { subject: string; text: string } {
  if (visibility === 'METADATA') return { subject: '', text: '' };
  if (visibility === 'SUBJECT') return { subject, text: '' };
  return { subject, text };
}

function participantOf(row: Row): ThreadParticipantDto {
  return {
    handle: (row.handle as string) ?? '',
    displayName: (row.display_name as string) ?? null,
    role: (row.role as string) ?? 'TO',
    personId: (row.person_id as string) ?? null,
  };
}

export async function listThreads(
  workspaceId: string,
  objectNameSingular: TimelineObjectSingular,
  recordId: string,
  page: number,
): Promise<{ threads: ThreadPreviewDto[]; total: number }> {
  const scope = await resolveScope(workspaceId, objectNameSingular, recordId);
  const threadIds = await scopedThreadIds(workspaceId, scope);
  if (threadIds.length === 0) return { threads: [], total: 0 };

  const messageRepo = await repo(workspaceId, 'message');
  const messages = await messageRepo
    .createQueryBuilder('m')
    .where('m.message_thread_id IN (:...tids)', { tids: threadIds })
    .orderBy('m.received_at', 'DESC')
    .getRawMany<Row>();

  const messageIds = messages.map((m) => m.m_id as string);
  const assocRepo = await repo(workspaceId, 'message_channel_message_association');
  const assocs = messageIds.length
    ? await assocRepo
        .createQueryBuilder('a')
        .where('a.message_id IN (:...ids)', { ids: messageIds })
        .getRawMany<Row>()
    : [];
  const assocByMessage = new Map<string, Row>(assocs.map((a) => [a.a_message_id as string, a]));
  const info = await channelInfo([...new Set(assocs.map((a) => a.a_message_channel_id as string))]);

  const participantRepo = await repo(workspaceId, 'message_participant');
  const participants = messageIds.length
    ? await participantRepo
        .createQueryBuilder('mp')
        .where('mp.message_id IN (:...ids)', { ids: messageIds })
        .getRawMany<Row>()
    : [];

  // Group by thread.
  const byThread = new Map<string, Row[]>();
  for (const m of messages) {
    const tid = m.m_message_thread_id as string;
    (byThread.get(tid) ?? byThread.set(tid, []).get(tid)!).push(m);
  }

  const previews: ThreadPreviewDto[] = [];
  for (const [tid, threadMessages] of byThread) {
    const latest = threadMessages[0]!;
    const latestId = latest.m_id as string;
    const assoc = assocByMessage.get(latestId);
    const channel = assoc ? info.get(assoc.a_message_channel_id as string) : undefined;
    const masked = mask(channel?.visibility, (latest.m_subject as string) ?? '', (latest.m_text_markdown as string) ?? '');

    const threadParticipants = participants
      .filter((p) => threadMessages.some((m) => m.m_id === p.mp_message_id))
      .map((p) => participantOf(unprefix(p, 'mp_')));
    const dedup = new Map(threadParticipants.map((p) => [p.handle, p]));

    previews.push({
      id: tid,
      subject: masked.subject,
      lastMessageAt: latest.m_received_at ? new Date(latest.m_received_at as string).toISOString() : null,
      snippet: masked.text.slice(0, 140),
      messageCount: threadMessages.length,
      participants: [...dedup.values()],
      sourceHandle: channel?.handle ?? null,
    });
  }

  previews.sort((a, b) => (b.lastMessageAt ?? '').localeCompare(a.lastMessageAt ?? ''));
  const total = previews.length;
  const start = (page - 1) * PAGE_SIZE;
  return { threads: previews.slice(start, start + PAGE_SIZE), total };
}

export async function getThread(workspaceId: string, threadId: string): Promise<ThreadDetailDto> {
  const messageRepo = await repo(workspaceId, 'message');
  const messages = await messageRepo
    .createQueryBuilder('m')
    .where('m.message_thread_id = :tid', { tid: threadId })
    .orderBy('m.received_at', 'ASC')
    .getRawMany<Row>();

  const messageIds = messages.map((m) => m.m_id as string);
  const assocRepo = await repo(workspaceId, 'message_channel_message_association');
  const assocs = messageIds.length
    ? await assocRepo.createQueryBuilder('a').where('a.message_id IN (:...ids)', { ids: messageIds }).getRawMany<Row>()
    : [];
  const assocByMessage = new Map<string, Row>(assocs.map((a) => [a.a_message_id as string, a]));
  const info = await channelInfo([...new Set(assocs.map((a) => a.a_message_channel_id as string))]);

  const participantRepo = await repo(workspaceId, 'message_participant');
  const participants = messageIds.length
    ? await participantRepo
        .createQueryBuilder('mp')
        .where('mp.message_id IN (:...ids)', { ids: messageIds })
        .getRawMany<Row>()
    : [];

  const dtoMessages: ThreadMessageDto[] = messages.map((m) => {
    const id = m.m_id as string;
    const assoc = assocByMessage.get(id);
    const channel = assoc ? info.get(assoc.a_message_channel_id as string) : undefined;
    const masked = mask(channel?.visibility, (m.m_subject as string) ?? '', (m.m_text_markdown as string) ?? '');
    return {
      id,
      subject: masked.subject,
      text: masked.text,
      receivedAt: m.m_received_at ? new Date(m.m_received_at as string).toISOString() : null,
      direction: (assoc?.a_direction as string) ?? 'INCOMING',
      participants: participants
        .filter((p) => p.mp_message_id === id)
        .map((p) => participantOf(unprefix(p, 'mp_'))),
    };
  });

  return {
    id: threadId,
    subject: dtoMessages.find((m) => m.subject)?.subject ?? '',
    messages: dtoMessages,
  };
}

/** Enqueue an outbound email (compose or reply) through one of the member's own channels. */
export async function sendMessage(
  workspaceId: string,
  workspaceMemberId: string,
  input: SendMessageRequest,
): Promise<void> {
  const channel = await dataSource
    .getRepository(MessageChannelEntity)
    .findOneBy({ id: input.messageChannelId, workspaceId });
  if (!channel) throw new NotFoundError('Message channel not found');
  const account = await dataSource
    .getRepository(ConnectedAccountEntity)
    .findOneBy({ id: channel.connectedAccountId, workspaceId, workspaceMemberId });
  if (!account) throw new NotFoundError('Message channel not found');

  await enqueueMessageSend({
    workspaceId,
    connectedAccountId: account.id,
    messageChannelId: channel.id,
    to: input.to,
    cc: input.cc,
    bcc: input.bcc,
    subject: input.subject,
    body: input.body,
    inReplyToHeaderMessageId: input.inReplyToHeaderMessageId ?? null,
    messageThreadId: input.messageThreadId ?? null,
  });
}

/** Query builders return raw rows with an alias prefix (e.g. `mp_handle`); strip it. */
function unprefix(row: Row, prefix: string): Row {
  const out: Row = {};
  for (const [k, v] of Object.entries(row)) {
    out[k.startsWith(prefix) ? k.slice(prefix.length) : k] = v;
  }
  return out;
}
