// Node/condition/field ids for the builder. `crypto.randomUUID` is only available in secure contexts
// (HTTPS or localhost) — dev runs on http://<sub>.lvh.me, where it's undefined — so fall back to a
// getRandomValues-based UUID (and then a Math.random one). These ids are DAG identifiers, not secrets.
export function newId(): string {
  const c = globalThis.crypto;
  if (c?.randomUUID) return c.randomUUID();
  if (c?.getRandomValues) {
    const bytes = c.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6]! & 0x0f) | 0x40;
    bytes[8] = (bytes[8]! & 0x3f) | 0x80;
    const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0'));
    return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10, 16).join('')}`;
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
