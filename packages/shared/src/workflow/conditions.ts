import type { StepFilter, StepFilterGroup } from './schemas.js';

/**
 * Evaluate the grouped condition model (already variable-resolved). Each group combines its child
 * filters + child sub-groups with its `logicalOperator` (AND/OR); nesting is resolved recursively.
 * A flat list with no groups is ANDed. Empty → true (no gate).
 */
export function evaluateConditions(
  filters: StepFilter[],
  groups: StepFilterGroup[] = [],
): boolean {
  if (!filters || filters.length === 0) return true;

  if (!groups || groups.length === 0) {
    return filters.every(evaluateOne); // legacy flat model
  }

  const roots = groups.filter((g) => !g.parentStepFilterGroupId);
  const rootIds = roots.length > 0 ? roots.map((g) => g.id) : ['root'];
  // AND across root groups (there is normally exactly one root).
  return rootIds.every((id) => evaluateGroup(id, filters, groups));
}

function evaluateGroup(groupId: string, filters: StepFilter[], groups: StepFilterGroup[]): boolean {
  const group = groups.find((g) => g.id === groupId);
  const operator = group?.logicalOperator ?? 'AND';
  const childFilters = filters.filter((f) => (f.stepFilterGroupId ?? 'root') === groupId);
  const childGroups = groups.filter((g) => g.parentStepFilterGroupId === groupId);

  const results = [
    ...childFilters.map(evaluateOne),
    ...childGroups.map((g) => evaluateGroup(g.id, filters, groups)),
  ];
  if (results.length === 0) return true;
  return operator === 'OR' ? results.some(Boolean) : results.every(Boolean);
}

function evaluateOne(filter: StepFilter): boolean {
  const left = filter.leftValue;
  const right = filter.rightValue;
  switch (filter.operand) {
    case 'eq':
      return String(left ?? '') === String(right ?? '');
    case 'ne':
      return String(left ?? '') !== String(right ?? '');
    case 'gt':
      return num(left) > num(right);
    case 'gte':
      return num(left) >= num(right);
    case 'lt':
      return num(left) < num(right);
    case 'lte':
      return num(left) <= num(right);
    case 'contains':
      return String(left ?? '').toLowerCase().includes(String(right ?? '').toLowerCase());
    case 'doesNotContain':
      return !String(left ?? '').toLowerCase().includes(String(right ?? '').toLowerCase());
    case 'isEmpty':
      return left == null || String(left) === '';
    case 'isNotEmpty':
      return left != null && String(left) !== '';
    case 'isTrue':
      return left === true || left === 'true';
    case 'isFalse':
      return left === false || left === 'false';
    default:
      return false;
  }
}

function num(value: unknown): number {
  const n = Number(value);
  return Number.isNaN(n) ? 0 : n;
}
