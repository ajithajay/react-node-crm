import { ImapFlow, type ImapFlowOptions } from 'imapflow';
import { simpleParser } from 'mailparser';
import nodemailer from 'nodemailer';
import type { ConnectedAccountEntity, ImapSmtpCaldavParams, MessageChannelEntity, MessageFolderEntity } from '@saasly/database';
import { decryptSecret } from '../../../lib/crypto.js';
import { env } from '../../../lib/config.js';
import { logger } from '../../../lib/logger.js';
import type { FetchResult, MailProvider, NormalizedParticipant, ParticipantRole } from './types.js';

/** In dev, tolerate self-signed certs (e.g. GreenMail's imaps/smtps). Enforced in production. */
const devTls = env.NODE_ENV === 'production' ? undefined : { rejectUnauthorized: false };

interface DecodedParams extends ImapSmtpCaldavParams {
  password: string;
}

function decodeParams(account: ConnectedAccountEntity): DecodedParams {
  const params = account.connectionParameters;
  if (!params) throw new Error(`Connected account ${account.id} has no connection parameters`);
  const password = params.passwordCiphertext ? decryptSecret(params.passwordCiphertext) : '';
  return { ...params, password };
}

function imapClient(account: ConnectedAccountEntity, params: DecodedParams): ImapFlow {
  const options: ImapFlowOptions = {
    host: params.imapHost!,
    port: params.imapPort ?? 993,
    secure: params.imapSecure ?? true,
    auth: { user: params.username ?? account.handle, pass: params.password },
    logger: false,
    tls: devTls,
  };
  return new ImapFlow(options);
}

function toParticipants(
  envelope: { from?: AddressList; to?: AddressList; cc?: AddressList; bcc?: AddressList } | undefined,
): NormalizedParticipant[] {
  const out: NormalizedParticipant[] = [];
  const add = (list: AddressList | undefined, role: ParticipantRole) => {
    for (const a of list ?? []) {
      if (!a.address) continue;
      out.push({ role, handle: a.address.toLowerCase(), displayName: a.name || null });
    }
  };
  add(envelope?.from, 'FROM');
  add(envelope?.to, 'TO');
  add(envelope?.cc, 'CC');
  add(envelope?.bcc, 'BCC');
  return out;
}

type AddressList = { name?: string; address?: string }[];

/** Strip Re:/Fwd: prefixes for a simple subject-based thread key. */
function threadKey(subject: string, references: string | undefined): string {
  if (references) {
    const first = references.trim().split(/\s+/)[0];
    if (first) return first;
  }
  return subject.replace(/^((re|fwd|fw)\s*:\s*)+/i, '').trim().toLowerCase() || '(no subject)';
}

function parseCursor(cursor: string | null): { uidValidity: string; lastUid: number } | null {
  if (!cursor) return null;
  const [uidValidity, lastUid] = cursor.split(':');
  if (!uidValidity || !lastUid) return null;
  return { uidValidity, lastUid: Number(lastUid) };
}

export const imapProvider: MailProvider = {
  async listFolders(account) {
    const params = decodeParams(account);
    const client = imapClient(account, params);
    await client.connect();
    try {
      const boxes = await client.list();
      return boxes
        .filter((b) => !b.flags?.has('\\Noselect'))
        .map((b) => {
          const specialUse = b.specialUse ?? '';
          const isSentFolder = specialUse === '\\Sent' || /sent/i.test(b.name);
          return { name: b.path, externalId: b.path, isSentFolder };
        });
    } finally {
      await client.logout().catch(() => undefined);
    }
  },

  async fetchNewMessages(account, channel, folders, opts) {
    const params = decodeParams(account);
    const client = imapClient(account, params);
    const result: FetchResult = { messages: [], folderCursors: {} };
    await client.connect();
    try {
      const syncedFolders = folders.filter((f) => f.isSynced);
      let budget = opts.maxMessages;
      for (const folder of syncedFolders) {
        if (budget <= 0) break;
        const lock = await client.getMailboxLock(folder.externalId ?? folder.name);
        try {
          const mailbox = client.mailbox;
          if (!mailbox || typeof mailbox === 'boolean') continue;
          const uidValidity = String(mailbox.uidValidity ?? '0');
          const prev = parseCursor(folder.syncCursor);
          // If UIDVALIDITY changed, the server invalidated UIDs — resync this folder from scratch.
          const cursorValid = prev && prev.uidValidity === uidValidity;
          const fromUid = opts.fullSync || !cursorValid ? 1 : prev!.lastUid + 1;

          let maxSeenUid = cursorValid ? prev!.lastUid : 0;
          const range = `${fromUid}:*`;
          const collected: { uid: number; source: Buffer; internalDate: Date; envelope: RawEnvelope }[] = [];
          for await (const msg of client.fetch(
            { uid: range },
            { uid: true, envelope: true, internalDate: true, source: true },
          )) {
            if (msg.uid < fromUid) continue; // `:*` always returns the last message even if none match
            collected.push({
              uid: msg.uid,
              source: msg.source as Buffer,
              internalDate: msg.internalDate as Date,
              envelope: msg.envelope as RawEnvelope,
            });
          }
          // Newest first, bounded by remaining budget.
          collected.sort((a, b) => b.uid - a.uid);
          for (const item of collected.slice(0, budget)) {
            const parsed = await simpleParser(item.source).catch(() => null);
            const subject = item.envelope?.subject ?? parsed?.subject ?? '';
            const references = Array.isArray(parsed?.references)
              ? parsed?.references.join(' ')
              : (parsed?.references as string | undefined);
            result.messages.push({
              externalId: `${folder.externalId ?? folder.name}:${item.uid}`,
              threadExternalId: threadKey(subject, references),
              headerMessageId: item.envelope?.messageId ?? parsed?.messageId ?? `${folder.name}:${item.uid}`,
              subject,
              text: parsed?.text ?? '',
              receivedAt: item.internalDate ?? parsed?.date ?? new Date(),
              direction: folder.isSentFolder ? 'OUTGOING' : 'INCOMING',
              participants: toParticipants(item.envelope),
            });
            maxSeenUid = Math.max(maxSeenUid, item.uid);
          }
          budget -= Math.min(collected.length, budget);
          result.folderCursors[folder.id] = `${uidValidity}:${maxSeenUid}`;
        } finally {
          lock.release();
        }
      }
    } catch (err) {
      logger.error({ err, channelId: channel.id }, '[messaging] IMAP fetch failed');
      throw err;
    } finally {
      await client.logout().catch(() => undefined);
    }
    return result;
  },

  async sendMessage(account, message) {
    const params = decodeParams(account);
    const transport = nodemailer.createTransport({
      host: params.smtpHost,
      port: params.smtpPort ?? 465,
      secure: params.smtpSecure ?? true,
      auth: { user: params.username ?? account.handle, pass: params.password },
      ...(devTls ? { tls: devTls } : {}),
    });
    const info = await transport.sendMail({
      from: account.handle,
      to: message.to,
      cc: message.cc.length ? message.cc : undefined,
      bcc: message.bcc.length ? message.bcc : undefined,
      subject: message.subject,
      text: message.body,
      inReplyTo: message.inReplyTo ?? undefined,
      references: message.inReplyTo ?? undefined,
    });
    return { externalId: info.messageId };
  },
};

interface RawEnvelope {
  subject?: string;
  messageId?: string;
  from?: AddressList;
  to?: AddressList;
  cc?: AddressList;
  bcc?: AddressList;
}
