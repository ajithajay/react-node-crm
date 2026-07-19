import type { WorkflowRunStepInfos } from './schemas.js';

/**
 * Variable interpolation for workflow action inputs — a simplified take on Twenty's resolver
 * (`packages/twenty-shared/src/utils/variable-resolver.ts`). Twenty compiles `{{...}}` via Handlebars;
 * we resolve a plain dot-path (`trigger.record.name`, `<stepId>.result.field`) against the run context.
 * Pure — no ORM/React (fits the @saasly/shared constraint).
 */

const VARIABLE_PATTERN = /\{\{([^{}]+)\}\}/g;

/** Resolve a dot-path (with optional `[index]`) against an object; returns undefined if any hop misses. */
export function getByPath(context: Record<string, unknown>, path: string): unknown {
  const parts = path
    .trim()
    .replace(/\[(\w+)\]/g, '.$1')
    .split('.')
    .filter(Boolean);

  let current: unknown = context;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function resolveString(input: string, context: Record<string, unknown>): unknown {
  const tokens = input.match(VARIABLE_PATTERN);
  if (!tokens || tokens.length === 0) return input;

  // A lone `{{path}}` that IS the whole string resolves to the raw value (preserves type).
  if (tokens.length === 1 && tokens[0] === input) {
    return getByPath(context, input.slice(2, -2));
  }

  // Otherwise interpolate into the surrounding text, stringifying objects.
  return input.replace(VARIABLE_PATTERN, (_match, path: string) => {
    const value = getByPath(context, path);
    if (value == null) return '';
    return typeof value === 'object' ? JSON.stringify(value) : String(value);
  });
}

/** Recursively resolve every `{{...}}` template in an action input against the run context. */
export function resolveInput(unresolved: unknown, context: Record<string, unknown>): unknown {
  if (unresolved == null) return unresolved;
  if (typeof unresolved === 'string') return resolveString(unresolved, context);
  if (Array.isArray(unresolved)) return unresolved.map((item) => resolveInput(item, context));
  if (typeof unresolved === 'object') {
    return Object.fromEntries(
      Object.entries(unresolved as Record<string, unknown>).map(([key, value]) => [
        key,
        resolveInput(value, context),
      ]),
    );
  }
  return unresolved;
}

/**
 * Build the context object consumed by `resolveInput`: `{ [stepId]: stepResult }` for every step that
 * has produced a result (the trigger is keyed under `trigger`). Mirrors Twenty's `getWorkflowRunContext`.
 */
export function getWorkflowRunContext(
  stepInfos: WorkflowRunStepInfos,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(stepInfos)
      .filter(([, info]) => info?.result !== undefined && info?.result !== null)
      .map(([stepId, info]) => [stepId, info.result]),
  );
}
