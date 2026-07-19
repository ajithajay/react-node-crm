import net from 'node:net';
import dns from 'node:dns';
import { Agent, buildConnector, fetch as undiciFetch } from 'undici';

/**
 * `isBlockedHost`-style checks that only inspect the literal hostname of the *first* request are
 * bypassed by an HTTP redirect: `fetch` follows redirects by default, and the redirect target's
 * host is never re-checked. This validates the actual IP at connection time instead — for a
 * literal-IP target directly, and via a custom DNS lookup for a hostname target — so every hop
 * (including redirects, which each open a fresh connection through this same dispatcher) is
 * re-validated. Mirrors twenty's connection-level `SecureHttpClientService` pattern, adapted to
 * undici's connector hook instead of a Node `http.Agent`'s `lookup` event.
 * Duplicated from `apps/api/src/lib/ssrf-safe-fetch.ts`: Node-only, can't live in `@saasly/shared`.
 */

const ALLOW_PRIVATE = process.env.WEBHOOK_ALLOW_PRIVATE_TARGETS === 'true';

export function isBlockedIp(address: string): boolean {
  if (ALLOW_PRIVATE) return false;
  if (address.includes(':')) {
    const host = address.toLowerCase();
    return host === '::1' || host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80') || host === '::';
  }
  const parts = address.split('.').map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return true;
  const [a = 0, b = 0] = parts;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  return false;
}

function safeLookup(
  hostname: string,
  options: dns.LookupOptions,
  callback: (err: NodeJS.ErrnoException | null, address: string | dns.LookupAddress[], family?: number) => void,
): void {
  dns.lookup(hostname, options, (err, address, family) => {
    if (err) return callback(err, address as never, family);
    const results = Array.isArray(address) ? address : [{ address, family: family! }];
    const blocked = results.find((r) => isBlockedIp(r.address));
    if (blocked) {
      callback(new Error(`Blocked host: ${hostname} resolves to private address ${blocked.address}`), '');
      return;
    }
    callback(null, address, family);
  });
}

const defaultConnector = buildConnector({ lookup: safeLookup } as buildConnector.BuildOptions);

function ssrfSafeConnector(
  options: buildConnector.Options,
  callback: buildConnector.Callback,
): void {
  const ipFamily = net.isIP(options.hostname);
  if (ipFamily && isBlockedIp(options.hostname)) {
    callback(new Error(`Blocked host: literal IP ${options.hostname}`), null);
    return;
  }
  defaultConnector(options, callback);
}

let sharedAgent: Agent | undefined;

/** A shared undici Agent that re-validates the resolved IP on every connection, including redirects. */
export function getSsrfSafeDispatcher(): Agent {
  sharedAgent ??= new Agent({ connect: ssrfSafeConnector });
  return sharedAgent;
}

/**
 * Drop-in for `fetch()` that blocks requests (and redirects) to private/internal addresses.
 * Uses `undici`'s own `fetch` (not the Node-global one) so the dispatcher/handler interface always
 * matches this `Agent` — mixing a `dispatcher` from the `undici` package with Node's built-in global
 * `fetch` (backed by Node's own internal, possibly different-versioned, undici copy) throws an
 * "invalid onRequestStart method" error when the two handler-interface versions don't line up.
 */
export function ssrfSafeFetch(url: string, init: RequestInit = {}): Promise<Response> {
  if (!/^https?:$/.test(new URL(url).protocol)) {
    return Promise.reject(new Error('Blocked protocol: only http/https are allowed'));
  }
  return undiciFetch(url, { ...init, dispatcher: getSsrfSafeDispatcher() } as RequestInit) as unknown as Promise<Response>;
}
