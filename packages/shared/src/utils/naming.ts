/** snake_case -> camelCase, e.g. `annual_revenue` -> `annualRevenue`. Pure, framework-agnostic —
 * shared between the record API's field codec/query-parser (apps/api) and the record UI (apps/web)
 * so both sides derive the exact same JSON key from a field's metadata `name`. */
export function toCamelCase(snake: string): string {
  return snake.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());
}
