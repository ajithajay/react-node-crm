import { google } from 'googleapis';
import { ConnectedAccountEntity } from '@saasly/database';
import { dataSource } from '../../../lib/db.js';
import { env } from '../../../lib/config.js';
import { decryptSecret, encryptSecret } from '../../../lib/crypto.js';
import { logger } from '../../../lib/logger.js';

/**
 * Build an OAuth2 client for a connected Google account from its stored (encrypted) tokens. The
 * client auto-refreshes the access token as needed; when it rotates tokens we persist them back
 * (re-encrypted) so the next run reuses the fresh token. Uses googleapis' own auth class so the
 * client type matches what `google.gmail`/`google.calendar` expect (avoids dual google-auth-library).
 */
export function getGoogleClient(account: ConnectedAccountEntity) {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    throw new Error('Google OAuth is not configured (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET).');
  }
  const client = new google.auth.OAuth2(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, env.GOOGLE_OAUTH_REDIRECT_URI);
  client.setCredentials({
    access_token: account.accessTokenCiphertext ? decryptSecret(account.accessTokenCiphertext) : undefined,
    refresh_token: account.refreshTokenCiphertext ? decryptSecret(account.refreshTokenCiphertext) : undefined,
    expiry_date: account.tokenExpiresAt ? account.tokenExpiresAt.getTime() : undefined,
  });

  client.on('tokens', (tokens) => {
    void (async () => {
      try {
        const patch: Partial<ConnectedAccountEntity> = {};
        if (tokens.access_token) patch.accessTokenCiphertext = encryptSecret(tokens.access_token);
        if (tokens.refresh_token) patch.refreshTokenCiphertext = encryptSecret(tokens.refresh_token);
        if (tokens.expiry_date) patch.tokenExpiresAt = new Date(tokens.expiry_date);
        if (Object.keys(patch).length > 0) {
          await dataSource.getRepository(ConnectedAccountEntity).update({ id: account.id }, patch);
        }
      } catch (err) {
        logger.error({ err, accountId: account.id }, '[google] failed to persist refreshed tokens');
      }
    })();
  });

  return client;
}
