import vm from 'node:vm';
import { transformSync } from 'esbuild';
import { inferCodeParams } from '@saasly/shared';
import { runCodeInChildProcess } from '../../lib/code-runner.js';
import { ssrfSafeFetch } from '../../lib/ssrf-safe-fetch.js';

/**
 * "Test" runs for the builder's HTTP / Code steps — executed inline in the api (the builder needs a
 * synchronous response). Mirrors the worker's action handlers; the real runs still happen in the worker.
 */

const ALLOW_PRIVATE = process.env.WEBHOOK_ALLOW_PRIVATE_TARGETS === 'true';

export interface HttpTestResult {
  status?: number;
  ok?: boolean;
  body?: unknown;
  durationMs?: number;
  error?: string;
}

export async function runHttpTest(input: {
  url?: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}): Promise<HttpTestResult> {
  const url = String(input.url ?? '');
  const method = String(input.method ?? 'GET').toUpperCase();
  if (!url) return { error: 'No URL provided' };
  try {
    const parsed = new URL(url);
    if (isBlockedHost(parsed.hostname)) return { error: `Blocked host: ${parsed.hostname}` };
  } catch {
    return { error: `Invalid URL: ${url}` };
  }

  const started = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await ssrfSafeFetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', ...(input.headers ?? {}) },
      body: method !== 'GET' && method !== 'HEAD' && input.body ? input.body : undefined,
      signal: controller.signal,
    });
    const text = await res.text();
    let body: unknown = text;
    try {
      body = JSON.parse(text);
    } catch {
      /* keep text */
    }
    return { status: res.status, ok: res.ok, body, durationMs: Date.now() - started };
  } catch (err) {
    return { error: (err as Error).message, durationMs: Date.now() - started };
  } finally {
    clearTimeout(timeout);
  }
}

export interface CodeTestResult {
  result?: unknown;
  error?: string;
  durationMs?: number;
}

export async function runCodeTest(code: string, params: Record<string, unknown>): Promise<CodeTestResult> {
  const started = Date.now();
  if (!code.trim()) return { result: null, durationMs: 0 };
  try {
    const coerced = JSON.parse(JSON.stringify(coerceComplexParams(code, params ?? {})));
    const js = transformSync(code, { loader: 'ts', format: 'cjs' }).code;
    const { result, error } = await runCodeInChildProcess(js, coerced, coerced);
    if (error) return { error, durationMs: Date.now() - started };
    return { result: result ?? null, durationMs: Date.now() - started };
  } catch (err) {
    return { error: (err as Error).message, durationMs: Date.now() - started };
  }
}

/**
 * Test-tab params typed as array/object arrive as raw text (JSON, or a JS object/array literal with
 * unquoted keys) — parse them so `Array.isArray`/property access behave as expected. Mirrors the
 * worker's `actions.ts#coerceComplexParams` (duplicated: this is a Node-only helper, can't live in
 * `@saasly/shared` since that package is also bundled into the browser build).
 */
function coerceComplexParams(rawCode: string, params: Record<string, unknown>): Record<string, unknown> {
  const complexNames = new Set(
    inferCodeParams(rawCode)
      .filter((p) => p.type !== 'string' && p.type !== 'number' && p.type !== 'boolean')
      .map((p) => p.name),
  );
  const out: Record<string, unknown> = { ...params };
  for (const [key, value] of Object.entries(out)) {
    if (complexNames.has(key) && typeof value === 'string') out[key] = coerceLiteralOrExpression(value);
  }
  return out;
}

function coerceLiteralOrExpression(raw: string): unknown {
  const trimmed = raw.trim();
  if (!trimmed) return raw;
  try {
    return JSON.parse(trimmed);
  } catch {
    try {
      const value: unknown = new vm.Script(`(${trimmed})`).runInContext(vm.createContext({}), { timeout: 500 });
      return JSON.parse(JSON.stringify(value));
    } catch {
      return raw;
    }
  }
}

function isBlockedHost(hostname: string): boolean {
  if (ALLOW_PRIVATE) return false;
  const host = hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) return true;
  if (host === '::1' || host.startsWith('fc') || host.startsWith('fd')) return true;
  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.\d{1,3}$/.exec(host);
  if (ipv4) {
    const [, a, b] = ipv4.map(Number) as [number, number, number, number];
    if (a === 10 || a === 127 || (a === 169 && b === 254) || (a === 192 && b === 168)) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
  }
  return false;
}
