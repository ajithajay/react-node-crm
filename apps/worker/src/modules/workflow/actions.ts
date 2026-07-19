import vm from 'node:vm';
import { transformSync } from 'esbuild';
import {
  WorkflowActionType,
  inferCodeParams,
  resolveInput,
  type StepFilter,
  type StepFilterGroup,
  type WorkflowStep,
} from '@saasly/shared';
import { createEmailDriver } from '../../lib/email-driver.js';
import * as records from './record-access.js';
import { evaluateConditions } from './conditions.js';

export interface ActionOutput {
  result?: unknown;
  error?: string;
  /** FILTER: stop this branch when the condition fails. */
  halt?: boolean;
  /** IF_ELSE: which branch to follow. */
  branch?: 'true' | 'false';
  /** DELAY/FORM: pause the run; DELAY sets delayMs for a re-enqueue, FORM waits for external submit. */
  pending?: boolean;
  delayMs?: number;
  /** ITERATOR: run the loop body once per item. */
  iterate?: { items: unknown[] };
}

const ALLOW_PRIVATE = process.env.WEBHOOK_ALLOW_PRIVATE_TARGETS === 'true';

/** Run one action. `input` is already variable-resolved against the run context. */
export async function runAction(
  workspaceId: string,
  step: WorkflowStep,
  input: Record<string, unknown>,
  context: Record<string, unknown>,
): Promise<ActionOutput> {
  const t = WorkflowActionType;
  switch (step.type) {
    case t.CREATE_RECORD: {
      const record = await records.createRecord(workspaceId, String(input.objectName), asObject(input.objectRecord));
      return { result: { record, id: record.id } };
    }
    case t.UPDATE_RECORD: {
      const record = await records.updateRecord(
        workspaceId,
        String(input.objectName),
        String(input.objectRecordId),
        asObject(input.objectRecord),
      );
      return { result: { record, id: record.id } };
    }
    case t.UPSERT_RECORD: {
      const record = await records.upsertRecord(
        workspaceId,
        String(input.objectName),
        String(input.uniqueFieldName ?? 'id'),
        input.objectRecordId ? String(input.objectRecordId) : undefined,
        asObject(input.objectRecord),
      );
      return { result: { record, id: record.id } };
    }
    case t.DELETE_RECORD: {
      await records.deleteRecord(workspaceId, String(input.objectName), String(input.objectRecordId));
      return { result: { deletedId: input.objectRecordId } };
    }
    case t.FIND_RECORDS: {
      // The filter's `leftValue` (a `{{record.field}}` template) must resolve per-candidate-row, not
      // against the run context — so it's read RAW from the step's settings (bypassing the executor's
      // already-resolved `input`), and only `rightValue` is resolved against the run context now.
      const rawFilter = (step.settings?.input as Record<string, unknown> | undefined)?.filter as
        | { stepFilters?: StepFilter[]; stepFilterGroups?: StepFilterGroup[] }
        | undefined;
      const resolvedFilters = (rawFilter?.stepFilters ?? []).map((f) => ({
        ...f,
        rightValue: resolveInput(f.rightValue, context),
      }));
      const found = await records.findRecords(workspaceId, String(input.objectName), {
        limit: Number(input.limit) || 20,
        offset: Number(input.offset) || 0,
        sort: input.sort as { field: string; direction: string } | null,
        stepFilters: resolvedFilters,
        stepFilterGroups: rawFilter?.stepFilterGroups ?? [],
      });
      return { result: { records: found, count: found.length, first: found[0] ?? null } };
    }
    case t.FILTER: {
      const passed = evaluateConditions(
        (input.stepFilters as StepFilter[]) ?? [],
        (input.stepFilterGroups as StepFilterGroup[]) ?? [],
      );
      return { result: { passed }, halt: !passed };
    }
    case t.IF_ELSE: {
      const passed = evaluateConditions(
        (input.stepFilters as StepFilter[]) ?? [],
        (input.stepFilterGroups as StepFilterGroup[]) ?? [],
      );
      return { result: { matched: passed ? 'true' : 'false' }, branch: passed ? 'true' : 'false' };
    }
    case t.DELAY: {
      const unit = String(input.unit ?? 'MINUTES');
      const duration = Number(input.duration) || 1;
      const ms = duration * (UNIT_MS[unit] ?? 60000);
      return { pending: true, delayMs: ms, result: { waitedMs: ms } };
    }
    case t.ITERATOR: {
      const items = Array.isArray(input.items) ? input.items : [];
      return { iterate: { items }, result: { count: items.length } };
    }
    case t.SEND_EMAIL: {
      const to = String(input.to ?? '');
      const subject = String(input.subject ?? '');
      const body = String(input.body ?? '');
      await createEmailDriver().send({ to, subject, html: body || subject, text: body || subject });
      return { result: { to, subject, sent: true } };
    }
    case t.HTTP_REQUEST:
      return httpRequest(input);
    case t.CODE:
      return runCode(step, input, context);
    case t.FORM:
      // Human-input pause — resumed by the public form submit (8g). Waits until then.
      return { pending: true, result: { awaitingInput: true } };
    default:
      return { error: `Unsupported action type: ${step.type}` };
  }
}

const UNIT_MS: Record<string, number> = {
  SECONDS: 1000,
  MINUTES: 60000,
  HOURS: 3600000,
  DAYS: 86400000,
};

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

async function httpRequest(input: Record<string, unknown>): Promise<ActionOutput> {
  const url = String(input.url ?? '');
  const method = String(input.method ?? 'POST').toUpperCase();
  if (!url) return { error: 'HTTP request has no URL' };
  try {
    const parsed = new URL(url);
    if (isBlockedHost(parsed.hostname)) return { error: `Blocked host: ${parsed.hostname}` };
  } catch {
    return { error: `Invalid URL: ${url}` };
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...asStringMap(input.headers) };
  const hasBody = method !== 'GET' && method !== 'HEAD';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(url, {
      method,
      headers,
      body: hasBody && input.body ? String(input.body) : undefined,
      signal: controller.signal,
    });
    const text = await res.text();
    let parsed: unknown = text;
    try {
      parsed = JSON.parse(text);
    } catch {
      /* keep as text */
    }
    return { result: { status: res.status, ok: res.ok, body: parsed } };
  } catch (err) {
    return { error: `HTTP request failed: ${(err as Error).message}` };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Run a user TypeScript snippet that exports `main(params)`. esbuild transpiles TS→JS, then it runs in a
 * locked-down `node:vm` context (no `require`/`process`/`globalThis`, deep-cloned inputs) with a compile
 * timeout; `main` is called with the step's (variable-resolved) `params` and its return is captured.
 * NOTE: `node:vm` is a soft isolation boundary, not a hardened sandbox — acceptable for v1's
 * self-service automations; documented in task-list.md.
 */
export async function runCode(
  step: WorkflowStep,
  input: Record<string, unknown>,
  context: Record<string, unknown>,
): Promise<ActionOutput> {
  const rawCode = String(((step.settings?.input as Record<string, unknown>)?.code as string) ?? '');
  if (!rawCode.trim()) return { result: null };
  const params = coerceComplexParams(rawCode, (input.params as Record<string, unknown>) ?? {});
  try {
    return await evalMain(rawCode, params, context);
  } catch (err) {
    return { error: `Code step failed: ${(err as Error).message}` };
  }
}

/**
 * Params typed as array/object (per the code's inferred signature) arrive as raw builder text — either
 * a `{{variable}}` already resolved to a real value by `resolveInput` (left untouched here), or literal
 * text the user typed directly (JSON, or a JS object/array literal with unquoted keys). Parse the
 * latter so `Array.isArray`/property access behave as the author expects instead of silently seeing a
 * string. Only touches params the signature declares non-primitive; string/number/boolean params are
 * never re-interpreted.
 */
export function coerceComplexParams(rawCode: string, params: Record<string, unknown>): Record<string, unknown> {
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
      // Fall back to evaluating as a JS expression — permits unquoted keys / single quotes, which
      // users naturally type for an inline object/array literal. Same trust boundary as the Code step
      // itself (the workspace's own automation), so a short-timeout vm eval is an acceptable v1.
      const value: unknown = new vm.Script(`(${trimmed})`).runInContext(vm.createContext({}), { timeout: 500 });
      return JSON.parse(JSON.stringify(value));
    } catch {
      return raw; // leave as-is; surfaces as a normal type mismatch downstream rather than crashing
    }
  }
}

/** Shared TS-snippet runner (used by the CODE action + the builder's test endpoint). */
export async function evalMain(
  rawCode: string,
  params: Record<string, unknown>,
  context: Record<string, unknown> = {},
): Promise<ActionOutput> {
  const js = transformSync(rawCode, { loader: 'ts', format: 'cjs' }).code;
  const moduleObj: { exports: Record<string, unknown> } = { exports: {} };
  const sandbox = vm.createContext({
    module: moduleObj,
    exports: moduleObj.exports,
    context: JSON.parse(JSON.stringify(context ?? {})),
    params: JSON.parse(JSON.stringify(params ?? {})),
  });
  new vm.Script(js).runInContext(sandbox, { timeout: 2000 });
  const main = (moduleObj.exports.main ?? (sandbox.exports as Record<string, unknown>)?.main) as
    | ((p: unknown) => unknown)
    | undefined;
  if (typeof main !== 'function') return { error: 'Code must `export const main = ...`' };
  const out = await main(JSON.parse(JSON.stringify(params ?? {})));
  return { result: out === undefined ? null : JSON.parse(JSON.stringify(out)) };
}

function asStringMap(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object') return {};
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, String(v)]));
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
