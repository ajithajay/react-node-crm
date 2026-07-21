import { createHmac } from 'node:crypto';
import { google } from 'googleapis';
import jwt from 'jsonwebtoken';
import { WorkspaceEntity } from '@saasly/database';
import { env } from '../../lib/config.js';
import { dataSource } from '../../lib/db.js';
import { AppError } from '../../lib/errors.js';
import { createGoogleAccount } from '../connected-account/connected-account.service.js';

/** Build the Settings→Accounts URL on the workspace's own subdomain (Google's redirect is host-agnostic). */
function accountsUrlForWorkspace(subdomain: string): string {
  const base = new URL(env.FRONTEND_URL);
  const port = base.port ? `:${base.port}` : '';
  return `${base.protocol}//${subdomain}.${env.APP_BASE_DOMAIN}${port}/settings/accounts`;
}

const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
  'openid',
];

const stateSecret = createHmac('sha256', env.JWT_SECRET).update('oauth-google-state').digest('hex');

interface StatePayload {
  workspaceId: string;
  workspaceMemberId: string;
}

function googleClient() {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.GOOGLE_OAUTH_REDIRECT_URI) {
    throw new AppError('Google OAuth is not configured (set GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_OAUTH_REDIRECT_URI).', 501);
  }
  return new google.auth.OAuth2(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, env.GOOGLE_OAUTH_REDIRECT_URI);
}

/** Build the Google consent URL, binding this workspace + member into a short-lived signed state. */
export function buildGoogleAuthUrl(workspaceId: string, workspaceMemberId: string): string {
  const client = googleClient();
  const state = jwt.sign({ workspaceId, workspaceMemberId } satisfies StatePayload, stateSecret, { expiresIn: '10m' });
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: GOOGLE_SCOPES,
    state,
  });
}

/**
 * Handle the OAuth callback: verify state, exchange the code for tokens, resolve the account email,
 * and create the connected account + channels. Returns where to redirect the browser afterwards.
 */
export async function handleGoogleCallback(code: string, state: string): Promise<string> {
  let payload: StatePayload;
  try {
    payload = jwt.verify(state, stateSecret) as StatePayload;
  } catch {
    throw new AppError('Invalid or expired OAuth state', 400);
  }

  const client = googleClient();
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);

  const oauth2 = google.oauth2({ version: 'v2', auth: client });
  const { data: userInfo } = await oauth2.userinfo.get();
  const handle = userInfo.email;
  if (!handle) throw new AppError('Could not resolve the Google account email', 400);

  await createGoogleAccount({
    workspaceId: payload.workspaceId,
    workspaceMemberId: payload.workspaceMemberId,
    handle,
    accessToken: tokens.access_token ?? '',
    refreshToken: tokens.refresh_token ?? null,
    tokenExpiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
    scopes: (tokens.scope ?? GOOGLE_SCOPES.join(' ')).split(' '),
  });

  const workspace = await dataSource.getRepository(WorkspaceEntity).findOneBy({ id: payload.workspaceId });
  return workspace ? accountsUrlForWorkspace(workspace.subdomain) : env.FRONTEND_URL;
}
