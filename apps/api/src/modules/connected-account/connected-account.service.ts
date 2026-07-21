import {
  CalendarChannelEntity,
  ConnectedAccountEntity,
  MessageChannelEntity,
  MessageFolderEntity,
} from '@saasly/database';
import type {
  CalendarChannelSummary,
  ConnectedAccountSummary,
  CreateImapSmtpAccountRequest,
  ImapSmtpParamsSummary,
  MessageChannelSummary,
  UpdateCalendarChannelRequest,
  UpdateImapSmtpAccountRequest,
  UpdateMessageChannelRequest,
  UpdateMessageFoldersRequest,
} from '@saasly/shared';
import { dataSource } from '../../lib/db.js';
import { env } from '../../lib/config.js';
import { decryptSecret, encryptSecret } from '../../lib/crypto.js';
import { NotFoundError } from '../../lib/errors.js';
import {
  enqueueCalendarChannelSync,
  enqueueMessageChannelSync,
  removeCalendarChannelSyncCrons,
  removeMessageChannelSyncCrons,
  upsertCalendarChannelSyncCron,
  upsertMessageChannelSyncCron,
} from '../../lib/queue.js';
import { record } from '../audit-log/audit-log.service.js';
import { verifyImapSmtp } from './imap-verify.js';

const accountRepo = () => dataSource.getRepository(ConnectedAccountEntity);
const messageChannelRepo = () => dataSource.getRepository(MessageChannelEntity);
const calendarChannelRepo = () => dataSource.getRepository(CalendarChannelEntity);
const messageFolderRepo = () => dataSource.getRepository(MessageFolderEntity);

function toMessageChannelSummary(
  channel: MessageChannelEntity,
  folders: MessageFolderEntity[],
): MessageChannelSummary {
  return {
    id: channel.id,
    handle: channel.handle,
    isSyncEnabled: channel.isSyncEnabled,
    syncStatus: channel.syncStatus,
    lastSyncedAt: channel.lastSyncedAt ? channel.lastSyncedAt.toISOString() : null,
    visibility: channel.visibility,
    isContactAutoCreationEnabled: channel.isContactAutoCreationEnabled,
    contactAutoCreationPolicy: channel.contactAutoCreationPolicy,
    excludeGroupEmails: channel.excludeGroupEmails,
    folders: folders
      .filter((f) => f.messageChannelId === channel.id)
      .map((f) => ({ id: f.id, name: f.name, isSentFolder: f.isSentFolder, isSynced: f.isSynced })),
  };
}

function toCalendarChannelSummary(channel: CalendarChannelEntity): CalendarChannelSummary {
  return {
    id: channel.id,
    handle: channel.handle,
    isSyncEnabled: channel.isSyncEnabled,
    syncStatus: channel.syncStatus,
    lastSyncedAt: channel.lastSyncedAt ? channel.lastSyncedAt.toISOString() : null,
    visibility: channel.visibility,
    isContactAutoCreationEnabled: channel.isContactAutoCreationEnabled,
  };
}

async function toSummary(account: ConnectedAccountEntity): Promise<ConnectedAccountSummary> {
  const [messageChannel, calendarChannel] = await Promise.all([
    messageChannelRepo().findOneBy({ connectedAccountId: account.id }),
    calendarChannelRepo().findOneBy({ connectedAccountId: account.id }),
  ]);
  const folders = messageChannel
    ? await messageFolderRepo().findBy({ messageChannelId: messageChannel.id })
    : [];
  const params = account.connectionParameters;
  const imapSmtp: ImapSmtpParamsSummary | null =
    account.provider === 'IMAP_SMTP_CALDAV' && params
      ? {
          imapHost: params.imapHost ?? '',
          imapPort: params.imapPort ?? 993,
          imapSecure: params.imapSecure ?? true,
          smtpHost: params.smtpHost ?? '',
          smtpPort: params.smtpPort ?? 465,
          smtpSecure: params.smtpSecure ?? true,
          caldavUrl: params.caldavUrl ?? '',
          username: params.username ?? '',
        }
      : null;
  return {
    id: account.id,
    provider: account.provider,
    handle: account.handle,
    authStatus: account.authStatus,
    createdAt: account.createdAt.toISOString(),
    messageChannel: messageChannel ? toMessageChannelSummary(messageChannel, folders) : null,
    calendarChannel: calendarChannel ? toCalendarChannelSummary(calendarChannel) : null,
    imapSmtp,
  };
}

/** Accounts the given workspace member has connected, newest first. */
export async function listConnectedAccounts(
  workspaceId: string,
  workspaceMemberId: string,
): Promise<ConnectedAccountSummary[]> {
  const accounts = await accountRepo().findBy({ workspaceId, workspaceMemberId });
  accounts.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return Promise.all(accounts.map(toSummary));
}

export async function getConnectedAccount(
  workspaceId: string,
  workspaceMemberId: string,
  accountId: string,
): Promise<ConnectedAccountSummary> {
  const account = await accountRepo().findOneBy({ id: accountId, workspaceId, workspaceMemberId });
  if (!account) throw new NotFoundError('Connected account not found');
  return toSummary(account);
}

/** Fully removes an account and (via ON DELETE CASCADE) its channels + folders. */
export async function deleteConnectedAccount(
  workspaceId: string,
  workspaceMemberId: string,
  actorUserId: string | null,
  accountId: string,
): Promise<void> {
  const account = await accountRepo().findOneBy({ id: accountId, workspaceId, workspaceMemberId });
  if (!account) throw new NotFoundError('Connected account not found');

  const messageChannels = await messageChannelRepo().findBy({ connectedAccountId: account.id });
  const calendarChannels = await calendarChannelRepo().findBy({ connectedAccountId: account.id });
  for (const c of messageChannels) await removeMessageChannelSyncCrons(c.id);
  for (const c of calendarChannels) await removeCalendarChannelSyncCrons(c.id);

  await accountRepo().remove(account);
  await record(workspaceId, actorUserId, 'connected_account.deleted', {
    provider: account.provider,
    handle: account.handle,
  });
}

// ---- IMAP/SMTP/CalDAV connect + channel config + sync ----

/** Arm the repeatable sync cron for a message channel and kick an immediate first sync. */
async function armMessageChannelSync(workspaceId: string, channelId: string, firstSync: boolean): Promise<void> {
  await upsertMessageChannelSyncCron({ workspaceId, channelId, phase: 'LIST_FETCH' }, env.MESSAGING_LIST_FETCH_CRON);
  if (firstSync) await enqueueMessageChannelSync({ workspaceId, channelId, phase: 'LIST_FETCH' });
}

async function armCalendarChannelSync(workspaceId: string, channelId: string, firstSync: boolean): Promise<void> {
  await upsertCalendarChannelSyncCron({ workspaceId, channelId, phase: 'LIST_FETCH' }, env.MESSAGING_LIST_FETCH_CRON);
  if (firstSync) await enqueueCalendarChannelSync({ workspaceId, channelId, phase: 'LIST_FETCH' });
}

export async function createImapSmtpAccount(
  workspaceId: string,
  workspaceMemberId: string,
  actorUserId: string | null,
  input: CreateImapSmtpAccountRequest,
): Promise<ConnectedAccountSummary> {
  const { folders, imapSecure, smtpSecure } = await verifyImapSmtp(input);

  const account = await accountRepo().save(
    accountRepo().create({
      workspaceId,
      workspaceMemberId,
      provider: 'IMAP_SMTP_CALDAV',
      handle: input.handle.toLowerCase(),
      authStatus: 'CONNECTED',
      connectionParameters: {
        imapHost: input.imapHost,
        imapPort: input.imapPort,
        imapSecure,
        smtpHost: input.smtpHost,
        smtpPort: input.smtpPort,
        smtpSecure,
        caldavUrl: input.caldavUrl || undefined,
        username: input.username,
        passwordCiphertext: encryptSecret(input.password),
      },
    }),
  );

  const messageChannel = await messageChannelRepo().save(
    messageChannelRepo().create({ workspaceId, connectedAccountId: account.id, handle: account.handle }),
  );

  await messageFolderRepo().save(
    folders.map((f) =>
      messageFolderRepo().create({
        workspaceId,
        messageChannelId: messageChannel.id,
        name: f.name,
        externalId: f.externalId,
        isSentFolder: f.isSentFolder,
        isSynced: f.defaultSynced,
      }),
    ),
  );

  if (input.caldavUrl) {
    const calendarChannel = await calendarChannelRepo().save(
      calendarChannelRepo().create({ workspaceId, connectedAccountId: account.id, handle: account.handle }),
    );
    await armCalendarChannelSync(workspaceId, calendarChannel.id, true);
  }

  await armMessageChannelSync(workspaceId, messageChannel.id, true);

  await record(workspaceId, actorUserId, 'connected_account.created', {
    provider: account.provider,
    handle: account.handle,
  });
  return toSummary(account);
}

/** Edit an IMAP/SMTP/CalDAV account's connection settings (re-verifies before saving). */
export async function updateImapSmtpAccount(
  workspaceId: string,
  workspaceMemberId: string,
  accountId: string,
  input: UpdateImapSmtpAccountRequest,
): Promise<ConnectedAccountSummary> {
  const account = await accountRepo().findOneBy({ id: accountId, workspaceId, workspaceMemberId });
  if (!account) throw new NotFoundError('Connected account not found');
  if (account.provider !== 'IMAP_SMTP_CALDAV') throw new NotFoundError('Not an IMAP/SMTP account');

  // Password omitted/blank → keep the current one (decrypt it to re-verify the connection).
  const existingPassword = account.connectionParameters?.passwordCiphertext
    ? decryptSecret(account.connectionParameters.passwordCiphertext)
    : '';
  const password = input.password && input.password.length > 0 ? input.password : existingPassword;

  const { imapSecure, smtpSecure } = await verifyImapSmtp({ ...input, handle: account.handle, password });

  account.connectionParameters = {
    imapHost: input.imapHost,
    imapPort: input.imapPort,
    imapSecure,
    smtpHost: input.smtpHost,
    smtpPort: input.smtpPort,
    smtpSecure,
    caldavUrl: input.caldavUrl || undefined,
    username: input.username,
    passwordCiphertext: encryptSecret(password),
  };
  account.authStatus = 'CONNECTED';
  account.authFailedAt = null;
  await accountRepo().save(account);
  return toSummary(account);
}

export interface GoogleAccountInput {
  workspaceId: string;
  workspaceMemberId: string;
  handle: string;
  accessToken: string;
  refreshToken: string | null;
  tokenExpiresAt: Date | null;
  scopes: string[];
}

/**
 * Create (or re-connect) a Google account from a completed OAuth exchange: stores encrypted tokens,
 * (re)creates the message + calendar channels with default Gmail folders, and kicks off the first sync.
 */
export async function createGoogleAccount(input: GoogleAccountInput): Promise<void> {
  const handle = input.handle.toLowerCase();
  // Re-connect: reuse the existing account row for this member+handle if present.
  const existing = await accountRepo().findOneBy({
    workspaceId: input.workspaceId,
    workspaceMemberId: input.workspaceMemberId,
    provider: 'GOOGLE',
    handle,
  });

  const account = await accountRepo().save(
    accountRepo().create({
      ...(existing ?? {}),
      workspaceId: input.workspaceId,
      workspaceMemberId: input.workspaceMemberId,
      provider: 'GOOGLE',
      handle,
      authStatus: 'CONNECTED',
      authFailedAt: null,
      scopes: input.scopes,
      accessTokenCiphertext: encryptSecret(input.accessToken),
      refreshTokenCiphertext: input.refreshToken ? encryptSecret(input.refreshToken) : existing?.refreshTokenCiphertext ?? null,
      tokenExpiresAt: input.tokenExpiresAt,
    }),
  );

  let messageChannel = await messageChannelRepo().findOneBy({ connectedAccountId: account.id });
  if (!messageChannel) {
    messageChannel = await messageChannelRepo().save(
      messageChannelRepo().create({ workspaceId: input.workspaceId, connectedAccountId: account.id, handle }),
    );
    await messageFolderRepo().save([
      messageFolderRepo().create({ workspaceId: input.workspaceId, messageChannelId: messageChannel.id, name: 'INBOX', externalId: 'INBOX', isSynced: true }),
      messageFolderRepo().create({ workspaceId: input.workspaceId, messageChannelId: messageChannel.id, name: 'Sent', externalId: 'SENT', isSentFolder: true, isSynced: true }),
    ]);
  }

  let calendarChannel = await calendarChannelRepo().findOneBy({ connectedAccountId: account.id });
  if (!calendarChannel) {
    calendarChannel = await calendarChannelRepo().save(
      calendarChannelRepo().create({ workspaceId: input.workspaceId, connectedAccountId: account.id, handle }),
    );
  }

  await armMessageChannelSync(input.workspaceId, messageChannel.id, true);
  await armCalendarChannelSync(input.workspaceId, calendarChannel.id, true);
  await record(input.workspaceId, null, 'connected_account.created', { provider: 'GOOGLE', handle });
}

/** Load a message channel scoped to the member's own accounts. */
async function ownedMessageChannel(workspaceId: string, workspaceMemberId: string, channelId: string) {
  const channel = await messageChannelRepo().findOneBy({ id: channelId, workspaceId });
  if (!channel) throw new NotFoundError('Message channel not found');
  const account = await accountRepo().findOneBy({ id: channel.connectedAccountId, workspaceId, workspaceMemberId });
  if (!account) throw new NotFoundError('Message channel not found');
  return channel;
}

async function ownedCalendarChannel(workspaceId: string, workspaceMemberId: string, channelId: string) {
  const channel = await calendarChannelRepo().findOneBy({ id: channelId, workspaceId });
  if (!channel) throw new NotFoundError('Calendar channel not found');
  const account = await accountRepo().findOneBy({ id: channel.connectedAccountId, workspaceId, workspaceMemberId });
  if (!account) throw new NotFoundError('Calendar channel not found');
  return channel;
}

export async function updateMessageChannel(
  workspaceId: string,
  workspaceMemberId: string,
  channelId: string,
  input: UpdateMessageChannelRequest,
): Promise<void> {
  const channel = await ownedMessageChannel(workspaceId, workspaceMemberId, channelId);
  const wasEnabled = channel.isSyncEnabled;
  if (input.isSyncEnabled !== undefined) channel.isSyncEnabled = input.isSyncEnabled;
  if (input.visibility !== undefined) channel.visibility = input.visibility;
  if (input.isContactAutoCreationEnabled !== undefined)
    channel.isContactAutoCreationEnabled = input.isContactAutoCreationEnabled;
  if (input.contactAutoCreationPolicy !== undefined)
    channel.contactAutoCreationPolicy = input.contactAutoCreationPolicy;
  if (input.excludeGroupEmails !== undefined) channel.excludeGroupEmails = input.excludeGroupEmails;
  await messageChannelRepo().save(channel);

  if (input.isSyncEnabled === true && !wasEnabled) await armMessageChannelSync(workspaceId, channel.id, true);
  if (input.isSyncEnabled === false && wasEnabled) await removeMessageChannelSyncCrons(channel.id);
}

export async function updateCalendarChannel(
  workspaceId: string,
  workspaceMemberId: string,
  channelId: string,
  input: UpdateCalendarChannelRequest,
): Promise<void> {
  const channel = await ownedCalendarChannel(workspaceId, workspaceMemberId, channelId);
  const wasEnabled = channel.isSyncEnabled;
  if (input.isSyncEnabled !== undefined) channel.isSyncEnabled = input.isSyncEnabled;
  if (input.visibility !== undefined) channel.visibility = input.visibility;
  if (input.isContactAutoCreationEnabled !== undefined)
    channel.isContactAutoCreationEnabled = input.isContactAutoCreationEnabled;
  await calendarChannelRepo().save(channel);

  if (input.isSyncEnabled === true && !wasEnabled) await armCalendarChannelSync(workspaceId, channel.id, true);
  if (input.isSyncEnabled === false && wasEnabled) await removeCalendarChannelSyncCrons(channel.id);
}

export async function updateMessageFolders(
  workspaceId: string,
  workspaceMemberId: string,
  channelId: string,
  input: UpdateMessageFoldersRequest,
): Promise<void> {
  const channel = await ownedMessageChannel(workspaceId, workspaceMemberId, channelId);
  for (const f of input.folders) {
    await messageFolderRepo().update({ id: f.id, messageChannelId: channel.id }, { isSynced: f.isSynced });
  }
}

/** Manual "Sync now": reset to a full sync and enqueue an immediate tick. */
export async function syncMessageChannelNow(
  workspaceId: string,
  workspaceMemberId: string,
  channelId: string,
  actorUserId: string | null,
): Promise<void> {
  const channel = await ownedMessageChannel(workspaceId, workspaceMemberId, channelId);
  channel.syncStage = 'FULL_MESSAGE_LIST_FETCH_PENDING';
  await messageChannelRepo().save(channel);
  await enqueueMessageChannelSync({ workspaceId, channelId: channel.id, phase: 'LIST_FETCH' });
  await record(workspaceId, actorUserId, 'connected_account.sync_requested', { channelId: channel.id });
}

export async function syncCalendarChannelNow(
  workspaceId: string,
  workspaceMemberId: string,
  channelId: string,
  actorUserId: string | null,
): Promise<void> {
  const channel = await ownedCalendarChannel(workspaceId, workspaceMemberId, channelId);
  channel.syncStage = 'FULL_MESSAGE_LIST_FETCH_PENDING';
  await calendarChannelRepo().save(channel);
  await enqueueCalendarChannelSync({ workspaceId, channelId: channel.id, phase: 'LIST_FETCH' });
  await record(workspaceId, actorUserId, 'connected_account.sync_requested', { channelId: channel.id });
}

/** On API boot, re-arm sync crons for every enabled channel (they don't survive a Redis flush). */
export async function rearmAllChannelCrons(): Promise<void> {
  const messageChannels = await messageChannelRepo().findBy({ isSyncEnabled: true });
  for (const c of messageChannels) {
    await upsertMessageChannelSyncCron(
      { workspaceId: c.workspaceId, channelId: c.id, phase: 'LIST_FETCH' },
      env.MESSAGING_LIST_FETCH_CRON,
    );
  }
  const calendarChannels = await calendarChannelRepo().findBy({ isSyncEnabled: true });
  for (const c of calendarChannels) {
    await upsertCalendarChannelSyncCron(
      { workspaceId: c.workspaceId, channelId: c.id, phase: 'LIST_FETCH' },
      env.MESSAGING_LIST_FETCH_CRON,
    );
  }
}
