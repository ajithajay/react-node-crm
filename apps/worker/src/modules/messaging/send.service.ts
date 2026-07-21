import { ConnectedAccountEntity, MessageChannelEntity } from '@saasly/database';
import type { MessageSendJobData } from '@saasly/shared';
import { dataSource } from '../../lib/db.js';
import { logger } from '../../lib/logger.js';
import { getMailProvider } from './providers/index.js';
import type { NormalizedMessage, NormalizedParticipant } from './providers/types.js';
import { storeMessage } from './record-store.js';
import { domainOfHandle, resolveParticipants } from './sync.service.js';

function threadKeyFromSubject(subject: string): string {
  return subject.replace(/^((re|fwd|fw)\s*:\s*)+/i, '').trim().toLowerCase() || '(no subject)';
}

/** Send an outbound email via the account's provider, then persist it as an OUTGOING message. */
export async function sendMessage(data: MessageSendJobData): Promise<void> {
  const account = await dataSource
    .getRepository(ConnectedAccountEntity)
    .findOneBy({ id: data.connectedAccountId, workspaceId: data.workspaceId });
  if (!account) throw new Error(`Connected account ${data.connectedAccountId} not found`);
  const channel = await dataSource
    .getRepository(MessageChannelEntity)
    .findOneBy({ id: data.messageChannelId, workspaceId: data.workspaceId });
  if (!channel) throw new Error(`Message channel ${data.messageChannelId} not found`);

  const provider = getMailProvider(account.provider);
  const { externalId } = await provider.sendMessage(account, {
    to: data.to,
    cc: data.cc,
    bcc: data.bcc,
    subject: data.subject,
    body: data.body,
    inReplyTo: data.inReplyToHeaderMessageId,
  });

  const participants: NormalizedParticipant[] = [
    { role: 'FROM', handle: account.handle.toLowerCase(), displayName: null },
    ...data.to.map((h) => ({ role: 'TO' as const, handle: h.toLowerCase(), displayName: null })),
    ...data.cc.map((h) => ({ role: 'CC' as const, handle: h.toLowerCase(), displayName: null })),
    ...data.bcc.map((h) => ({ role: 'BCC' as const, handle: h.toLowerCase(), displayName: null })),
  ];

  const message: NormalizedMessage = {
    externalId: externalId || `sent-${account.id}-${data.subject}-${participants.map((p) => p.handle).join(',')}`,
    threadExternalId: data.messageThreadId ?? threadKeyFromSubject(data.subject),
    headerMessageId: externalId || '',
    subject: data.subject,
    text: data.body,
    receivedAt: new Date(),
    direction: 'OUTGOING',
    participants,
  };

  const resolutions = await resolveParticipants(data.workspaceId, message, channel, domainOfHandle(account.handle));
  await storeMessage({
    workspaceId: data.workspaceId,
    messageChannelId: channel.id,
    message,
    resolutions,
    forcedThreadId: data.messageThreadId ?? undefined,
  });

  logger.info({ channelId: channel.id, to: data.to }, '[messaging] outbound email sent');
}
