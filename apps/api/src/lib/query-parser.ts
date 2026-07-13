import type { SelectQueryBuilder } from 'typeorm';
import type { FieldMetadataEntity } from '@saasly/database';
import {
  FieldMetadataType,
  ViewFilterOperand,
  toCamelCase,
  type RecordFilter,
  type RecordListQuery,
} from '@saasly/shared';
import { AppError } from './errors.js';

const TEXT_LIKE_TYPES: ReadonlySet<FieldMetadataType> = new Set([FieldMetadataType.TEXT]);
const DATE_LIKE_TYPES: ReadonlySet<FieldMetadataType> = new Set([
  FieldMetadataType.DATE,
  FieldMetadataType.DATE_TIME,
]);
const COMPARABLE_TYPES: ReadonlySet<FieldMetadataType> = new Set([
  FieldMetadataType.NUMBER,
  FieldMetadataType.RATING,
  FieldMetadataType.DATE,
  FieldMetadataType.DATE_TIME,
]);

/**
 * Simple, single-column fields the parser can filter/sort/search on — composite types (CURRENCY,
 * EMAILS, ADDRESS, …) and the ONE_TO_MANY reverse side of RELATION are excluded (querying their
 * sub-fields needs more modeling; see task-list.md's Phase 6 follow-ups). MORPH_RELATION exposes
 * its `${key}Type`/`${key}Id` pair as two filterable pseudo-columns, matching the codec's shape.
 */
export interface FilterableField {
  field: FieldMetadataEntity;
  columnName: string;
}

export function buildFilterableFieldIndex(fields: FieldMetadataEntity[]): Map<string, FilterableField> {
  const index = new Map<string, FilterableField>();
  for (const field of fields) {
    if (field.type === FieldMetadataType.MORPH_RELATION) {
      const key = toCamelCase(field.name);
      index.set(`${key}Type`, { field, columnName: `${field.name}_target_type` });
      index.set(`${key}Id`, { field, columnName: `${field.name}_target_id` });
      continue;
    }

    if (field.type === FieldMetadataType.RELATION) {
      if (field.settings?.relationType === 'ONE_TO_MANY') continue;
      index.set(`${toCamelCase(field.name)}Id`, { field, columnName: `${field.name}_id` });
      continue;
    }

    const SIMPLE_TYPES: ReadonlySet<FieldMetadataType> = new Set([
      FieldMetadataType.TEXT,
      FieldMetadataType.NUMBER,
      FieldMetadataType.BOOLEAN,
      FieldMetadataType.DATE_TIME,
      FieldMetadataType.DATE,
      FieldMetadataType.SELECT,
      FieldMetadataType.MULTI_SELECT,
      FieldMetadataType.RATING,
      FieldMetadataType.FILES,
      FieldMetadataType.RAW_JSON,
      FieldMetadataType.ARRAY,
      FieldMetadataType.UUID,
    ]);
    if (!SIMPLE_TYPES.has(field.type)) continue;

    index.set(toCamelCase(field.name), { field, columnName: field.name });
  }
  return index;
}

function startOfUtcDay(offsetDays = 0): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + offsetDays));
}

/** Resolves an IS_RELATIVE filter's fixed vocabulary to a `[from, to)` range (`to` is null = open-ended). */
function resolveRelativeRange(value: unknown): { from: Date | null; to: Date | null } {
  const token = String(value).toUpperCase();
  const now = new Date();
  switch (token) {
    case 'TODAY':
      return { from: startOfUtcDay(0), to: startOfUtcDay(1) };
    case 'YESTERDAY':
      return { from: startOfUtcDay(-1), to: startOfUtcDay(0) };
    case 'THIS_WEEK':
      return { from: startOfUtcDay(-now.getUTCDay()), to: startOfUtcDay(7 - now.getUTCDay()) };
    case 'THIS_MONTH': {
      const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
      return { from: start, to: end };
    }
    case 'PAST':
      return { from: null, to: now };
    case 'FUTURE':
      return { from: now, to: null };
    default:
      throw new AppError(`Unsupported relative value "${token}" for IS_RELATIVE`, 400);
  }
}

function applyCondition(
  qb: SelectQueryBuilder<object>,
  alias: string,
  filterable: FilterableField,
  operand: ViewFilterOperand,
  value: unknown,
  paramSeq: { n: number },
): void {
  const col = `"${alias}"."${filterable.columnName}"`;
  const p = () => `p${paramSeq.n++}`;
  const { field } = filterable;

  switch (operand) {
    case ViewFilterOperand.IS: {
      const name = p();
      qb.andWhere(`${col} = :${name}`, { [name]: value });
      return;
    }
    case ViewFilterOperand.IS_NOT: {
      const name = p();
      qb.andWhere(`${col} != :${name}`, { [name]: value });
      return;
    }
    case ViewFilterOperand.IS_EMPTY:
      qb.andWhere(`${col} IS NULL`);
      return;
    case ViewFilterOperand.IS_NOT_EMPTY:
      qb.andWhere(`${col} IS NOT NULL`);
      return;
    case ViewFilterOperand.CONTAINS: {
      if (!TEXT_LIKE_TYPES.has(field.type)) throw new AppError('CONTAINS only supports text fields', 400);
      const name = p();
      qb.andWhere(`${col} ILIKE :${name}`, { [name]: `%${String(value)}%` });
      return;
    }
    case ViewFilterOperand.DOES_NOT_CONTAIN: {
      if (!TEXT_LIKE_TYPES.has(field.type)) throw new AppError('DOES_NOT_CONTAIN only supports text fields', 400);
      const name = p();
      qb.andWhere(`(${col} NOT ILIKE :${name} OR ${col} IS NULL)`, { [name]: `%${String(value)}%` });
      return;
    }
    case ViewFilterOperand.LESS_THAN_OR_EQUAL: {
      if (!COMPARABLE_TYPES.has(field.type)) throw new AppError('Operand not supported for this field type', 400);
      const name = p();
      qb.andWhere(`${col} <= :${name}`, { [name]: value });
      return;
    }
    case ViewFilterOperand.GREATER_THAN_OR_EQUAL: {
      if (!COMPARABLE_TYPES.has(field.type)) throw new AppError('Operand not supported for this field type', 400);
      const name = p();
      qb.andWhere(`${col} >= :${name}`, { [name]: value });
      return;
    }
    case ViewFilterOperand.IS_BEFORE: {
      if (!DATE_LIKE_TYPES.has(field.type)) throw new AppError('IS_BEFORE only supports date fields', 400);
      const name = p();
      qb.andWhere(`${col} < :${name}`, { [name]: value });
      return;
    }
    case ViewFilterOperand.IS_AFTER: {
      if (!DATE_LIKE_TYPES.has(field.type)) throw new AppError('IS_AFTER only supports date fields', 400);
      const name = p();
      qb.andWhere(`${col} > :${name}`, { [name]: value });
      return;
    }
    case ViewFilterOperand.IS_RELATIVE: {
      if (!DATE_LIKE_TYPES.has(field.type)) throw new AppError('IS_RELATIVE only supports date fields', 400);
      const { from, to } = resolveRelativeRange(value);
      if (from) {
        const name = p();
        qb.andWhere(`${col} >= :${name}`, { [name]: from });
      }
      if (to) {
        const name = p();
        qb.andWhere(`${col} < :${name}`, { [name]: to });
      }
      return;
    }
    default: {
      const exhaustive: never = operand;
      throw new AppError(`Unknown operand: ${String(exhaustive)}`, 400);
    }
  }
}

/**
 * Applies a flat AND-of-conditions filter list to a QueryBuilder (shared by the record list query
 * and dashboard chart-data aggregation, which both filter over the same "simple" field types).
 */
export function applyFilterConditions(
  qb: SelectQueryBuilder<object>,
  alias: string,
  filterable: Map<string, FilterableField>,
  conditions: RecordFilter,
  paramSeq: { n: number } = { n: 0 },
): void {
  for (const condition of conditions) {
    const target = filterable.get(condition.field);
    if (!target) throw new AppError(`Unknown or unfilterable field "${condition.field}"`, 400);
    applyCondition(qb, alias, target, condition.operand as ViewFilterOperand, condition.value, paramSeq);
  }
}

/**
 * Applies filter/search/sort/pagination (solution-approach.md §5's "shared query parser") to a
 * QueryBuilder scoped to one workspace object table. Mutates and returns the same builder.
 * v1 scope: a flat AND-of-conditions filter list (nested AND/OR groups are a documented follow-up)
 * over the "simple" field types listed in `buildFilterableFieldIndex`.
 */
export function applyRecordListQuery(
  qb: SelectQueryBuilder<object>,
  alias: string,
  fields: FieldMetadataEntity[],
  query: RecordListQuery,
): { page: number; pageSize: number } {
  const filterable = buildFilterableFieldIndex(fields);
  const paramSeq = { n: 0 };

  if (query.filter) {
    let conditions: RecordFilter;
    try {
      conditions = JSON.parse(query.filter) as RecordFilter;
    } catch {
      throw new AppError('filter must be valid JSON', 400);
    }
    if (!Array.isArray(conditions)) throw new AppError('filter must be a JSON array', 400);
    applyFilterConditions(qb, alias, filterable, conditions, paramSeq);
  }

  if (query.search) {
    const searchableTextColumns = [...filterable.values()].filter((f) => f.field.type === FieldMetadataType.TEXT);
    if (searchableTextColumns.length > 0) {
      const name = `p${paramSeq.n++}`;
      const clause = searchableTextColumns.map((f) => `"${alias}"."${f.columnName}" ILIKE :${name}`).join(' OR ');
      qb.andWhere(`(${clause})`, { [name]: `%${query.search}%` });
    }
  }

  if (query.sortField) {
    const target = filterable.get(query.sortField);
    if (!target) throw new AppError(`Unknown or unsortable field "${query.sortField}"`, 400);
    qb.orderBy(`"${alias}"."${target.columnName}"`, query.sortDirection === 'DESC' ? 'DESC' : 'ASC');
  } else {
    qb.orderBy(`"${alias}"."created_at"`, 'DESC');
  }

  qb.skip((query.page - 1) * query.pageSize).take(query.pageSize);
  return { page: query.page, pageSize: query.pageSize };
}
