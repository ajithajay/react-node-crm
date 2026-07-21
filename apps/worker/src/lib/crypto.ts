import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';
import { env } from './config.js';

/**
 * At-rest secret encryption/decryption for connected-account tokens / IMAP passwords. MUST match the
 * api's `crypto.ts` key derivation and format (`iv.authTag.ciphertext`, all hex) so ciphertext is
 * interchangeable between api and worker (e.g. api writes tokens, worker refreshes them).
 */
const secretEncryptionKey = scryptSync(env.JWT_SECRET, 'saasly-secret-encryption', 32);

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', secretEncryptionKey, iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString('hex'), authTag.toString('hex'), encrypted.toString('hex')].join('.');
}

export function decryptSecret(ciphertext: string): string {
  const [ivHex, authTagHex, dataHex] = ciphertext.split('.');
  if (!ivHex || !authTagHex || !dataHex) throw new Error('Malformed secret ciphertext');
  const decipher = createDecipheriv('aes-256-gcm', secretEncryptionKey, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]);
  return decrypted.toString('utf8');
}
