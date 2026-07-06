import { isValidIdentifier } from '@saasly/shared';

/**
 * Double-quote a Postgres identifier for safe interpolation into raw DDL. Every caller MUST
 * validate the identifier first (via `assertSafeIdentifier`) — this only escapes embedded quotes,
 * it does not sanitize.
 */
export function quoteIdent(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}

/**
 * Throws unless `value` is a validated snake_case identifier (@saasly/shared identifierSchema)
 * OR one of the fixed system names in `allow` (e.g. workspace schema names, which have their own
 * `workspace_<base36>` shape). Call this before ANY raw SQL interpolation of a user-controlled name.
 */
export function assertSafeIdentifier(value: string, allow?: RegExp): void {
  if (isValidIdentifier(value)) return;
  if (allow && allow.test(value)) return;
  throw new Error(`Unsafe SQL identifier: "${value}"`);
}
