import { ImapFlow } from 'imapflow';
import nodemailer from 'nodemailer';
import type { CreateImapSmtpAccountRequest } from '@saasly/shared';
import { env } from '../../lib/config.js';
import { AppError } from '../../lib/errors.js';

/** In dev, tolerate self-signed certs (e.g. GreenMail's imaps). Enforced in production. */
const devTls = env.NODE_ENV === 'production' ? undefined : { rejectUnauthorized: false };
const isDev = env.NODE_ENV !== 'production';

export interface DiscoveredFolder {
  name: string;
  externalId: string;
  isSentFolder: boolean;
  /** Spam/Trash default to not-synced. */
  defaultSynced: boolean;
}

export interface VerifyResult {
  folders: DiscoveredFolder[];
  /** The TLS settings that actually connected (may differ from the request if dev auto-detected plaintext). */
  imapSecure: boolean;
  smtpSecure: boolean;
}

const UNSYNCED_BY_DEFAULT = /(spam|junk|trash|deleted|bin)/i;

/** A TLS-handshake-vs-plaintext mismatch (client tried TLS, server spoke plaintext) or vice versa. */
function looksLikeTlsMismatch(err: unknown): boolean {
  const msg = (err as Error)?.message ?? '';
  return /ssl|packet length too long|wrong version number|routines|epROTO|EPROTO/i.test(msg);
}

async function listImapFolders(host: string, port: number, secure: boolean, user: string, pass: string) {
  const client = new ImapFlow({ host, port, secure, auth: { user, pass }, logger: false, tls: devTls });
  await client.connect();
  try {
    const boxes = await client.list();
    return boxes
      .filter((b) => !b.flags?.has('\\Noselect'))
      .map((b) => {
        const specialUse = b.specialUse ?? '';
        const isSentFolder = specialUse === '\\Sent' || /sent/i.test(b.name);
        return {
          name: b.path,
          externalId: b.path,
          isSentFolder,
          defaultSynced: !UNSYNCED_BY_DEFAULT.test(b.name) && specialUse !== '\\Junk' && specialUse !== '\\Trash',
        };
      });
  } finally {
    await client.logout().catch(() => undefined);
  }
}

/**
 * Verify IMAP + SMTP credentials by connecting, and return the folder list. In dev, if a TLS
 * connection fails with a protocol mismatch, retries once without TLS (so a local plaintext server
 * like GreenMail works without fiddling with the toggle) and reports the setting that worked.
 */
export async function verifyImapSmtp(input: CreateImapSmtpAccountRequest): Promise<VerifyResult> {
  let imapSecure = input.imapSecure;
  let folders: DiscoveredFolder[];
  try {
    folders = await listImapFolders(input.imapHost, input.imapPort, imapSecure, input.username, input.password);
  } catch (err) {
    if (isDev && imapSecure && looksLikeTlsMismatch(err)) {
      imapSecure = false;
      folders = await listImapFolders(input.imapHost, input.imapPort, false, input.username, input.password).catch(
        (retryErr) => {
          throw new AppError(`IMAP connection failed: ${(retryErr as Error).message}`, 400);
        },
      );
    } else {
      throw new AppError(`IMAP connection failed: ${(err as Error).message}`, 400);
    }
  }

  let smtpSecure = input.smtpSecure;
  const verifySmtp = (secure: boolean) =>
    nodemailer
      .createTransport({
        host: input.smtpHost,
        port: input.smtpPort,
        secure,
        auth: { user: input.username, pass: input.password },
        ...(devTls ? { tls: devTls } : {}),
      })
      .verify();
  try {
    await verifySmtp(smtpSecure);
  } catch (err) {
    if (isDev && smtpSecure && looksLikeTlsMismatch(err)) {
      smtpSecure = false;
      await verifySmtp(false).catch((retryErr) => {
        throw new AppError(`SMTP connection failed: ${(retryErr as Error).message}`, 400);
      });
    } else {
      throw new AppError(`SMTP connection failed: ${(err as Error).message}`, 400);
    }
  }

  return { folders, imapSecure, smtpSecure };
}
