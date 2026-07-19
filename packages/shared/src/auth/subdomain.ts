/** Pure subdomain-resolution + validation logic. */

export const RESERVED_SUBDOMAINS = [
  'app',
  'www',
  'api',
  'admin',
  'root',
  'mail',
  'smtp',
  'ftp',
  'ns1',
  'ns2',
  'support',
  'help',
  'status',
  'docs',
  'blog',
  'dashboard',
  'staging',
  'dev',
  'test',
  'localhost',
  'assets',
  'static',
  'cdn',
  'mailpit',
  'minio',
  'redis',
  'postgres',
] as const;

/** Lowercase alphanumeric + hyphen, 3-63 chars, cannot start/end with a hyphen. */
const SUBDOMAIN_FORMAT_RE = /^[a-z0-9]([a-z0-9-]{1,61}[a-z0-9])?$/;

export function isValidSubdomainFormat(subdomain: string): boolean {
  return subdomain.length >= 3 && subdomain.length <= 63 && SUBDOMAIN_FORMAT_RE.test(subdomain);
}

export function isReservedSubdomain(subdomain: string): boolean {
  return (RESERVED_SUBDOMAINS as readonly string[]).includes(subdomain.toLowerCase());
}

/**
 * Resolve the subdomain segment from a request Host header, given the configured base domain.
 * Returns `null` for the default/landing host (`app.<base>`, `<base>` itself, or a bare
 * `localhost`/IP dev host) — callers should treat `null` as "no workspace".
 */
export function extractSubdomain(host: string | undefined, baseDomain: string): string | null {
  if (!host) return null;
  const hostname = host.split(':')[0]!.toLowerCase();
  const base = baseDomain.toLowerCase();

  if (hostname === base || hostname === `app.${base}`) return null;
  if (!hostname.endsWith(`.${base}`)) return null;

  const sub = hostname.slice(0, -(`.${base}`.length));
  if (!sub || sub.includes('.')) return null;
  return sub;
}
