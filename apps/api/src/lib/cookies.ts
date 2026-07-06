import type { CookieOptions } from 'express';
import { env } from './config.js';
import { parseDurationMs } from './duration.js';

export const REFRESH_COOKIE_NAME = 'saasly_refresh';

/** Shared across app.<base> and every <sub>.<base> — solution-approach.md §6. */
export function refreshCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    domain: `.${env.APP_BASE_DOMAIN}`,
    path: '/',
    maxAge: parseDurationMs(env.REFRESH_TOKEN_TTL),
  };
}
