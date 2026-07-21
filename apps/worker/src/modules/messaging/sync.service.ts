import {
  CalendarChannelEntity,
  ConnectedAccountEntity,
  MessageChannelEntity,
  MessageFolderEntity,
  WorkspaceEntity,
} from '@saasly/database';
import { dataSource } from '../../lib/db.js';
import { env } from '../../lib/config.js';
import { logger } from '../../lib/logger.js';
import { getCalendarProvider, getMailProvider } from './providers/index.js';
import type { NormalizedEvent, NormalizedMessage, NormalizedParticipant } from './providers/types.js';
import {
  createPersonFromHandle,
  findPersonIdByEmail,
  findWorkspaceMemberIdByEmail,
  storeEvent,
  storeMessage,
  type ParticipantResolution,
} from './record-store.js';

const GROUP_LOCALPARTS = new Set([
  'all', 'team', 'everyone', 'noreply', 'no-reply', 'notifications', 'notification',
  'info', 'support', 'hello', 'contact', 'sales', 'admin', 'help', 'mailer-daemon', 'postmaster',
]);

function domainOf(handle: string): string {
  return handle.split('@')[1]?.toLowerCase() ?? '';
}

function isGroupHandle(handle: string): boolean {
  return GROUP_LOCALPARTS.has(handle.split('@')[0]?.toLowerCase() ?? '');
}

/** All participants share the connected account's domain → an internal email. */
function isInternal(message: NormalizedMessage, internalDomain: string): boolean {
  if (!internalDomain || message.participants.length === 0) return false;
  return message.participants.every((p) => domainOf(p.handle) === internalDomain);
}

/** Which handles a channel's contact-auto-creation policy allows creating a Person for. */
function shouldAutoCreate(
  policy: string,
  direction: NormalizedMessage['direction'],
  participant: NormalizedParticipant,
  internalDomain: string,
): boolean {
  if (policy === 'NONE') return false;
  if (domainOf(participant.handle) === internalDomain) return false; // never auto-create internal contacts
  if (isGroupHandle(participant.handle)) return false;
  if (policy === 'SENT_AND_RECEIVED') return true;
  // SENT: only from emails the user sent → their recipients.
  return direction === 'OUTGOING' && participant.role !== 'FROM';
}

export function domainOfHandle(handle: string): string {
  return domainOf(handle);
}

export async function resolveParticipants(
  workspaceId: string,
  message: NormalizedMessage,
  channel: MessageChannelEntity,
  internalDomain: string,
): Promise<Map<string, ParticipantResolution>> {
  const map = new Map<string, ParticipantResolution>();
  for (const p of message.participants) {
    const handle = p.handle.toLowerCase();
    if (map.has(handle)) continue;
    let personId = await findPersonIdByEmail(workspaceId, handle);
    const workspaceMemberId = await findWorkspaceMemberIdByEmail(workspaceId, handle);
    if (
      !personId &&
      channel.isContactAutoCreationEnabled &&
      shouldAutoCreate(channel.contactAutoCreationPolicy, message.direction, p, internalDomain)
    ) {
      personId = await createPersonFromHandle(workspaceId, handle, p.displayName);
    }
    map.set(handle, { personId, workspaceMemberId });
  }
  return map;
}

/** Sync one email channel: fetch new messages, match/auto-create contacts, persist. */
export async function syncMessageChannel(workspaceId: string, channelId: string): Promise<void> {
  const channelRepo = dataSource.getRepository(MessageChannelEntity);
  const channel = await channelRepo.findOneBy({ id: channelId, workspaceId });
  if (!channel) return;
  if (!channel.isSyncEnabled || !env.MESSAGING_SYNC_ENABLED) return;

  const account = await dataSource
    .getRepository(ConnectedAccountEntity)
    .findOneBy({ id: channel.connectedAccountId, workspaceId });
  if (!account) return;

  const workspace = await dataSource.getRepository(WorkspaceEntity).findOneByOrFail({ id: workspaceId });
  const folders = await dataSource.getRepository(MessageFolderEntity).findBy({ messageChannelId: channelId });
  const internalDomain = domainOf(account.handle);

  channel.syncStatus = 'ONGOING';
  channel.syncStageStartedAt = new Date();
  await channelRepo.save(channel);

  try {
    const provider = getMailProvider(account.provider);
    const fullSync = channel.syncStage === 'FULL_MESSAGE_LIST_FETCH_PENDING' || !channel.syncCursor;
    const result = await provider.fetchNewMessages(account, channel, folders, {
      fullSync,
      maxMessages: env.MESSAGING_IMPORT_MAX_PER_MIN,
    });

    let created = 0;
    for (const message of result.messages) {
      if (!workspace.syncInternalEmails && isInternal(message, internalDomain)) continue;
      const resolutions = await resolveParticipants(workspaceId, message, channel, internalDomain);
      const { created: didCreate } = await storeMessage({
        workspaceId,
        messageChannelId: channelId,
        message,
        resolutions,
      });
      if (didCreate) created += 1;
    }

    // Persist per-folder cursors.
    const folderRepo = dataSource.getRepository(MessageFolderEntity);
    for (const [folderId, cursor] of Object.entries(result.folderCursors)) {
      await folderRepo.update({ id: folderId }, { syncCursor: cursor });
    }

    channel.syncCursor = channel.syncCursor ?? 'synced';
    channel.syncStage = 'IDLE';
    channel.syncStatus = 'ACTIVE';
    channel.lastSyncedAt = new Date();
    channel.throttleFailureCount = 0;
    await channelRepo.save(channel);
    logger.info({ channelId, created, fetched: result.messages.length }, '[messaging] channel sync complete');
  } catch (err) {
    channel.syncStatus = 'FAILED';
    channel.throttleFailureCount += 1;
    await channelRepo.save(channel);
    logger.error({ err, channelId }, '[messaging] channel sync failed');
    throw err;
  }
}

function eventIsInternal(event: NormalizedEvent, internalDomain: string): boolean {
  if (!internalDomain || event.participants.length === 0) return false;
  return event.participants.every((p) => domainOf(p.handle) === internalDomain);
}

async function resolveEventParticipants(
  workspaceId: string,
  event: NormalizedEvent,
  autoCreate: boolean,
  internalDomain: string,
): Promise<Map<string, ParticipantResolution>> {
  const map = new Map<string, ParticipantResolution>();
  for (const p of event.participants) {
    const handle = p.handle.toLowerCase();
    if (map.has(handle)) continue;
    let personId = await findPersonIdByEmail(workspaceId, handle);
    const workspaceMemberId = await findWorkspaceMemberIdByEmail(workspaceId, handle);
    const external = domainOf(handle) !== internalDomain;
    if (!personId && autoCreate && external) {
      personId = await createPersonFromHandle(workspaceId, handle, p.displayName);
    }
    map.set(handle, { personId, workspaceMemberId });
  }
  return map;
}

/** Sync one calendar channel: fetch events, match/auto-create participant contacts, persist. */
export async function syncCalendarChannel(workspaceId: string, channelId: string): Promise<void> {
  const channelRepo = dataSource.getRepository(CalendarChannelEntity);
  const channel = await channelRepo.findOneBy({ id: channelId, workspaceId });
  if (!channel) return;
  if (!channel.isSyncEnabled || !env.CALENDAR_SYNC_ENABLED) return;

  const account = await dataSource
    .getRepository(ConnectedAccountEntity)
    .findOneBy({ id: channel.connectedAccountId, workspaceId });
  if (!account) return;

  const workspace = await dataSource.getRepository(WorkspaceEntity).findOneByOrFail({ id: workspaceId });
  const internalDomain = domainOf(account.handle);

  channel.syncStatus = 'ONGOING';
  channel.syncStageStartedAt = new Date();
  await channelRepo.save(channel);

  try {
    const provider = getCalendarProvider(account.provider);
    const fullSync = channel.syncStage === 'FULL_MESSAGE_LIST_FETCH_PENDING' || !channel.syncCursor;
    const result = await provider.fetchNewEvents(account, channel, {
      fullSync,
      cursor: channel.syncCursor,
      maxEvents: env.MESSAGING_IMPORT_MAX_PER_MIN,
    });

    let created = 0;
    for (const event of result.events) {
      if (!workspace.syncInternalEmails && eventIsInternal(event, internalDomain)) continue;
      const resolutions = await resolveEventParticipants(
        workspaceId,
        event,
        channel.isContactAutoCreationEnabled,
        internalDomain,
      );
      const { created: didCreate } = await storeEvent({ workspaceId, calendarChannelId: channelId, event, resolutions });
      if (didCreate) created += 1;
    }

    channel.syncCursor = result.cursor ?? channel.syncCursor ?? 'synced';
    channel.syncStage = 'IDLE';
    channel.syncStatus = 'ACTIVE';
    channel.lastSyncedAt = new Date();
    channel.throttleFailureCount = 0;
    await channelRepo.save(channel);
    logger.info({ channelId, created, fetched: result.events.length }, '[calendar] channel sync complete');
  } catch (err) {
    channel.syncStatus = 'FAILED';
    channel.throttleFailureCount += 1;
    await channelRepo.save(channel);
    logger.error({ err, channelId }, '[calendar] channel sync failed');
    throw err;
  }
}
