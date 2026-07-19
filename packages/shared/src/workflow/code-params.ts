/**
 * Infer the typed input parameters of a Code step from its `main(params: { a: string; b: number })`
 * signature. A lightweight regex parser (Twenty uses the TS compiler API); good enough for the flat
 * `{ key: type }` param objects our Code steps use. Powers the "a/b" input fields above the editor.
 */
export interface CodeParam {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'unknown';
}

export function inferCodeParams(code: string): CodeParam[] {
  // Grab the object-type body of the first parameter of `main`, i.e. the `{ ... }` after `params:`.
  const match = /main\s*=?\s*(?:async\s*)?\(\s*[A-Za-z0-9_]+\s*:\s*\{([^}]*)\}/.exec(code);
  if (!match) return [];
  const body = match[1] ?? '';
  const params: CodeParam[] = [];
  for (const part of body.split(/[;,\n]/)) {
    const m = /^\s*([A-Za-z0-9_]+)\s*\??\s*:\s*([A-Za-z0-9_<>'"[\] ]+)/.exec(part);
    if (!m) continue;
    const name = m[1]!;
    const raw = (m[2] ?? '').trim().toLowerCase();
    const type: CodeParam['type'] = raw.startsWith('string')
      ? 'string'
      : raw.startsWith('number')
        ? 'number'
        : raw.startsWith('boolean')
          ? 'boolean'
          : raw.startsWith('array') || raw.endsWith('[]')
            ? 'array'
            : raw.startsWith('{')
              ? 'object'
              : 'unknown';
    params.push({ name, type });
  }
  return params;
}
