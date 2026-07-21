import { gmail_v1, google } from 'googleapis';
import { logger } from '../../../lib/logger.js';
import { getGoogleClient } from './google-auth.js';
import type { FetchResult, MailProvider, NormalizedParticipant, ParticipantRole } from './types.js';

function gmailApi(account: Parameters<typeof getGoogleClient>[0]): gmail_v1.Gmail {
  return google.gmail({ version: 'v1', auth: getGoogleClient(account) });
}

/** Depth-first search the MIME tree for the first text/plain (fallback text/html) body. */
function extractText(payload: gmail_v1.Schema$MessagePart | undefined): string {
  if (!payload) return '';
  const decode = (data?: string | null) => (data ? Buffer.from(data, 'base64url').toString('utf8') : '');
  if (payload.mimeType === 'text/plain' && payload.body?.data) return decode(payload.body.data);
  let htmlFallback = '';
  for (const part of payload.parts ?? []) {
    const text = extractText(part);
    if (part.mimeType === 'text/plain' && text) return text;
    if (part.mimeType === 'text/html' && text && !htmlFallback) htmlFallback = text.replace(/<[^>]+>/g, ' ');
  }
  if (payload.mimeType === 'text/html' && payload.body?.data) return decode(payload.body.data).replace(/<[^>]+>/g, ' ');
  return htmlFallback;
}

function header(headers: gmail_v1.Schema$MessagePartHeader[] | undefined, name: string): string {
  return headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? '';
}

/** Parse an address-list header ("A <a@x>, b@y") into participants of a given role. */
function parseAddresses(value: string, role: ParticipantRole): NormalizedParticipant[] {
  if (!value) return [];
  return value
    .split(',')
    .map((raw) => raw.trim())
    .filter(Boolean)
    .map((raw) => {
      const match = /^(?:"?([^"<]*)"?\s*)?<?([^<>\s]+@[^<>\s]+)>?$/.exec(raw);
      const handle = (match?.[2] ?? raw).toLowerCase();
      const displayName = match?.[1]?.trim() || null;
      return { role, handle, displayName };
    });
}

export const gmailProvider: MailProvider = {
  async listFolders(account) {
    const gmail = gmailApi(account);
    const { data } = await gmail.users.labels.list({ userId: 'me' });
    return (data.labels ?? [])
      .filter((l) => l.id)
      .map((l) => ({ name: l.name ?? l.id!, externalId: l.id!, isSentFolder: l.id === 'SENT' }));
  },

  async fetchNewMessages(account, channel, folders, opts) {
    const gmail = gmailApi(account);
    const result: FetchResult = { messages: [], folderCursors: {} };
    let budget = opts.maxMessages;

    for (const folder of folders.filter((f) => f.isSynced)) {
      if (budget <= 0) break;
      const labelId = folder.externalId ?? folder.name;
      const list = await gmail.users.messages.list({ userId: 'me', labelIds: [labelId], maxResults: Math.min(budget, 100) });
      const ids = (list.data.messages ?? []).map((m) => m.id!).filter(Boolean);
      for (const id of ids.slice(0, budget)) {
        const { data: msg } = await gmail.users.messages.get({ userId: 'me', id, format: 'full' });
        const headers = msg.payload?.headers;
        const isSent = (msg.labelIds ?? []).includes('SENT');
        result.messages.push({
          externalId: msg.id!,
          threadExternalId: msg.threadId ?? msg.id!,
          headerMessageId: header(headers, 'Message-ID') || msg.id!,
          subject: header(headers, 'Subject'),
          text: extractText(msg.payload) || msg.snippet || '',
          receivedAt: msg.internalDate ? new Date(Number(msg.internalDate)) : new Date(),
          direction: isSent || folder.isSentFolder ? 'OUTGOING' : 'INCOMING',
          participants: [
            ...parseAddresses(header(headers, 'From'), 'FROM'),
            ...parseAddresses(header(headers, 'To'), 'TO'),
            ...parseAddresses(header(headers, 'Cc'), 'CC'),
          ],
        });
      }
      budget -= ids.length;
    }
    logger.info({ channelId: channel.id, fetched: result.messages.length }, '[gmail] fetch complete');
    return result;
  },

  async sendMessage(account, message) {
    const gmail = gmailApi(account);
    const lines = [
      `From: ${account.handle}`,
      `To: ${message.to.join(', ')}`,
      ...(message.cc.length ? [`Cc: ${message.cc.join(', ')}`] : []),
      ...(message.bcc.length ? [`Bcc: ${message.bcc.join(', ')}`] : []),
      `Subject: ${message.subject}`,
      ...(message.inReplyTo ? [`In-Reply-To: ${message.inReplyTo}`, `References: ${message.inReplyTo}`] : []),
      'Content-Type: text/plain; charset="UTF-8"',
      '',
      message.body,
    ];
    const raw = Buffer.from(lines.join('\r\n')).toString('base64url');
    const { data } = await gmail.users.messages.send({ userId: 'me', requestBody: { raw } });
    return { externalId: data.id ?? '' };
  },
};
