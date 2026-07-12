import type { DataModelField, ViewDetail } from '@/lib/api-client';
import type { FilterCondition } from '../components/FilterBar';
import { friendlyFieldKey } from './field-values';

/**
 * Bridges the table's in-memory filter/sort state (keyed by friendly JSON key, e.g. `accountOwnerId`)
 * and a saved view's persisted config (keyed by `fieldMetadataId`). Lets the table load a view's
 * saved filters/sorts and write the current ones back — closing gap B1 (filters were in-memory only).
 */

export function viewFiltersToConditions(
  view: ViewDetail,
  fieldsById: Map<string, DataModelField>,
): FilterCondition[] {
  return view.filters
    .map((vf): FilterCondition | null => {
      const field = fieldsById.get(vf.fieldMetadataId);
      if (!field) return null;
      return { field: friendlyFieldKey(field), operand: vf.operand, value: vf.value };
    })
    .filter((c): c is FilterCondition => !!c);
}

export function conditionsToViewFilters(
  conditions: FilterCondition[],
  fieldByKey: Map<string, DataModelField>,
): { fieldMetadataId: string; operand: string; value?: unknown }[] {
  return conditions
    .filter((c) => c.field && c.operand)
    .map((c) => {
      const field = fieldByKey.get(c.field);
      if (!field) return null;
      return { fieldMetadataId: field.id, operand: c.operand, value: c.value };
    })
    .filter((f): f is { fieldMetadataId: string; operand: string; value: unknown } => !!f);
}

export interface LocalSort {
  field: string | undefined;
  direction: 'ASC' | 'DESC';
}

export function viewSortToLocal(view: ViewDetail, fieldsById: Map<string, DataModelField>): LocalSort {
  const first = view.sorts[0];
  if (!first) return { field: undefined, direction: 'ASC' };
  const field = fieldsById.get(first.fieldMetadataId);
  return { field: field ? friendlyFieldKey(field) : undefined, direction: first.direction };
}

export function localSortToViewSorts(
  sortField: string | undefined,
  direction: 'ASC' | 'DESC',
  fieldByKey: Map<string, DataModelField>,
): { fieldMetadataId: string; direction: 'ASC' | 'DESC' }[] {
  if (!sortField) return [];
  const field = fieldByKey.get(sortField);
  if (!field) return [];
  return [{ fieldMetadataId: field.id, direction }];
}

/** Stable signature for comparing whether local filter/sort state differs from a view's saved config. */
export function stateSignature(
  conditions: FilterCondition[],
  sortField: string | undefined,
  sortDirection: 'ASC' | 'DESC',
): string {
  const filters = conditions
    .filter((c) => c.field && c.operand)
    .map((c) => [c.field, c.operand, c.value ?? null]);
  return JSON.stringify({ filters, sort: sortField ? [sortField, sortDirection] : null });
}
