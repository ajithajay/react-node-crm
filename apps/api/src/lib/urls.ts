import { env } from './config.js';

/**
 * Builds an absolute URL on `<subdomain>.<APP_BASE_DOMAIN>`, preserving FRONTEND_URL's
 * protocol/port. `pathAndQuery` is concatenated as-is (it may already contain an encoded query
 * string) — assigning it via `url.pathname` would percent-encode its own `?`.
 */
export function buildWorkspaceUrl(subdomain: string, pathAndQuery = '/'): string {
  const url = new URL(env.FRONTEND_URL);
  url.hostname = `${subdomain}.${env.APP_BASE_DOMAIN}`;
  return `${url.protocol}//${url.host}${pathAndQuery}`;
}

/** Builds an absolute URL on the default/landing host (`app.<APP_BASE_DOMAIN>` or FRONTEND_URL as-is). */
export function buildAppUrl(path: string, query?: Record<string, string>): string {
  const url = new URL(env.FRONTEND_URL);
  url.pathname = path;
  if (query) for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
  return url.toString();
}
