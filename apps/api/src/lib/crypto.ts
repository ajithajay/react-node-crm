import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync } from 'node:crypto';
import { env } from './config.js';

export function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/** Symmetric key for at-rest secrets (e.g. TOTP seeds), derived once from JWT_SECRET. */
const secretEncryptionKey = scryptSync(env.JWT_SECRET, 'saasly-secret-encryption', 32);

/** AES-256-GCM encrypt; output is `iv.authTag.ciphertext` (all hex). */
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
