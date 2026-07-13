import { FieldMetadataEntity, ObjectMetadataEntity } from '@saasly/database';
import {
  AGGREGATE_OPERATIONS,
  CHART_ORDER_BY_OPTIONS,
  DATE_GRANULARITIES,
  FieldMetadataType,
  type AggregateOperation,
  type ChartDataPoint,
  type ChartDataResponse,
  type ChartOrderBy,
  type DashboardWidgetConfiguration,
  type DateGranularity,
} from '@saasly/shared';
import { dataSource } from '../../lib/db.js';
import { workspaceDataSourceCache } from '../../lib/workspace-data-source.js';
import { applyFilterConditions, buildFilterableFieldIndex } from '../../lib/query-parser.js';
import { AppError, NotFoundError } from '../../lib/errors.js';
import { assertObjectAccess, resolveActorRole, type Principal } from '../record/record-permission.js';

const objectRepo = () => dataSource.getRepository(ObjectMetadataEntity);
const fieldRepo = () => dataSource.getRepository(FieldMetadataEntity);

type RawKey = string | number | Date | null;

/** The physical column a field's value lives in — mirrors `field-column-mapper.ts`'s naming for the
 * scalar/simple types dashboards can aggregate or group by (a subset of `buildFilterableFieldIndex`'s
 * "simple" types, since charts also allow grouping on a forward RELATION's own FK column). */
function resolveScalarColumn(field: FieldMetadataEntity): string {
  if (field.type === FieldMetadataType.CURRENCY) return `${field.name}_amount_micros`;
  if (field.type === FieldMetadataType.RELATION) return `${field.name}_id`;
  return field.name;
}

function buildAggregateExpr(alias: string, operation: AggregateOperation, field: FieldMetadataEntity | null): string {
  if (operation === 'COUNT' || !field) return 'COUNT(*)';
  const column = resolveScalarColumn(field);
  const col = `"${alias}"."${column}"`;
  const expr = field.type === FieldMetadataType.CURRENCY ? `(${col}::numeric / 1000000)` : col;
  switch (operation) {
    case 'SUM':
      return `COALESCE(SUM(${expr}), 0)`;
    case 'AVG':
      return `COALESCE(AVG(${expr}), 0)`;
    case 'MIN':
      return `MIN(${expr})`;
    case 'MAX':
      return `MAX(${expr})`;
    default:
      return 'COUNT(*)';
  }
}

const GROUP_BY_ELIGIBLE_TYPES: ReadonlySet<FieldMetadataType> = new Set([
  FieldMetadataType.TEXT,
  FieldMetadataType.BOOLEAN,
  FieldMetadataType.SELECT,
  FieldMetadataType.NUMBER,
  FieldMetadataType.RATING,
  FieldMetadataType.DATE,
  FieldMetadataType.DATE_TIME,
  FieldMetadataType.RELATION,
  FieldMetadataType.UUID,
]);

function isDateField(field: FieldMetadataEntity): boolean {
  return field.type === FieldMetadataType.DATE || field.type === FieldMetadataType.DATE_TIME;
}

function normalizeGranularity(granularity: DateGranularity | undefined): DateGranularity {
  return granularity && (DATE_GRANULARITIES as readonly string[]).includes(granularity) ? granularity : 'MONTH';
}

function buildGroupByExpr(alias: string, field: FieldMetadataEntity, granularity: DateGranularity | undefined): string {
  const column = resolveScalarColumn(field);
  const col = `"${alias}"."${column}"`;
  if (isDateField(field)) return `date_trunc('${normalizeGranularity(granularity).toLowerCase()}', ${col})`;
  return col;
}

/** Formats a `date_trunc`'d Date key into a short, granularity-appropriate label instead of the raw
 * `Date.toString()` (which would render as e.g. "Wed Jan 01 2026 00:00:00 GMT+0000..." on the chart). */
function formatDateKey(date: Date, granularity: DateGranularity): string {
  const opts: Intl.DateTimeFormatOptions =
    granularity === 'YEAR'
      ? { year: 'numeric' }
      : granularity === 'QUARTER' || granularity === 'MONTH'
        ? { year: 'numeric', month: 'short' }
        : { year: 'numeric', month: 'short', day: 'numeric' };
  return new Intl.DateTimeFormat('en-US', opts).format(date);
}

function rawKeyToString(key: RawKey, field: FieldMetadataEntity | null, granularity: DateGranularity | undefined): string {
  if (key === null) return '__null__';
  if (key instanceof Date) return key.toISOString();
  if (field && isDateField(field)) return new Date(key).toISOString();
  void granularity;
  return String(key);
}

/** Resolve a group-by field's raw keys to display labels: RELATION ids via a follow-up lookup
 * against the target object's table (single-hop only); DATE/DATE_TIME via granularity-aware
 * formatting; everything else passes through as-is. */
async function resolveGroupLabels(
  workspaceId: string,
  field: FieldMetadataEntity,
  granularity: DateGranularity | undefined,
  keys: RawKey[],
): Promise<Map<string, string>> {
  const labelByKey = new Map<string, string>();

  if (isDateField(field)) {
    const g = normalizeGranularity(granularity);
    for (const k of keys) {
      const asKey = rawKeyToString(k, field, granularity);
      if (k !== null && !labelByKey.has(asKey)) labelByKey.set(asKey, formatDateKey(k instanceof Date ? k : new Date(k), g));
    }
    labelByKey.set('__null__', 'No value');
    return labelByKey;
  }

  if (field.type !== FieldMetadataType.RELATION) {
    for (const k of keys) {
      const asKey = rawKeyToString(k, field, granularity);
      if (!labelByKey.has(asKey)) labelByKey.set(asKey, k === null ? 'No value' : String(k));
    }
    return labelByKey;
  }

  const targetObjectId = field.settings?.relationTargetObjectMetadataId as string | undefined;
  const targetObject = targetObjectId ? await objectRepo().findOneBy({ id: targetObjectId, workspaceId }) : null;
  const ids = keys.filter((k): k is string => typeof k === 'string');

  if (!targetObject || ids.length === 0) {
    for (const k of keys) {
      const asKey = rawKeyToString(k, field, granularity);
      labelByKey.set(asKey, k === null ? 'No value' : String(k));
    }
    return labelByKey;
  }

  const labelField = targetObject.labelIdentifierFieldMetadataId
    ? await fieldRepo().findOneBy({ id: targetObject.labelIdentifierFieldMetadataId })
    : null;
  const labelExpr =
    labelField?.type === FieldMetadataType.FULL_NAME
      ? `CONCAT_WS(' ', "t"."${labelField.name}_first_name", "t"."${labelField.name}_last_name")`
      : labelField
        ? `"t"."${labelField.name}"`
        : `"t"."id"`;

  const workspaceDataSource = await workspaceDataSourceCache.getWorkspaceDataSource(workspaceId);
  const targetRepo = workspaceDataSource.getRepository(targetObject.nameSingular);
  const rows = await targetRepo
    .createQueryBuilder('t')
    .select('"t"."id"', 'id')
    .addSelect(labelExpr, 'label')
    .where('"t"."id" IN (:...ids)', { ids })
    .getRawMany<{ id: string; label: string | null }>();

  for (const row of rows) labelByKey.set(row.id, row.label?.trim() || 'Unnamed');
  for (const k of keys) {
    const asKey = rawKeyToString(k, field, granularity);
    if (!labelByKey.has(asKey)) labelByKey.set(asKey, k === null ? 'No value' : 'Unknown');
  }
  return labelByKey;
}

function parseNumeric(raw: string | number | null | undefined): number {
  if (raw === null || raw === undefined) return 0;
  const n = typeof raw === 'number' ? raw : parseFloat(raw);
  return Number.isFinite(n) ? n : 0;
}

function resolveOrderBy(orderBy: ChartOrderBy | undefined): ChartOrderBy {
  return orderBy && (CHART_ORDER_BY_OPTIONS as readonly string[]).includes(orderBy) ? orderBy : 'VALUE_DESC';
}

/**
 * Compute chart data for a GRAPH widget (any of the four sub-types) at read time — the net-new
 * aggregation capability Phase 7 needed (the record API only ever did list/filter/sort/paginate).
 * Enforces the caller's object read permission exactly like the record API does. Supports an
 * optional secondary group-by (2D grouping — e.g. stage × company for a grouped/multi-series
 * bar/line chart), returning `secondaryKey` alongside `key` on each point.
 */
export async function computeChartData(
  workspaceId: string,
  principal: Principal,
  objectMetadataId: string,
  configuration: DashboardWidgetConfiguration,
): Promise<ChartDataResponse> {
  const object = await objectRepo().findOneBy({ id: objectMetadataId, workspaceId });
  if (!object) throw new NotFoundError('Object not found');

  const actor = await resolveActorRole(principal, workspaceId);
  await assertObjectAccess(actor, object.id, 'read');

  const fields = await fieldRepo().findBy({ workspaceId, objectMetadataId, isActive: true });
  const fieldById = new Map(fields.map((f) => [f.id, f]));

  const operation: AggregateOperation =
    configuration.aggregateOperation && (AGGREGATE_OPERATIONS as readonly string[]).includes(configuration.aggregateOperation)
      ? configuration.aggregateOperation
      : 'COUNT';
  const aggregateField = configuration.aggregateFieldMetadataId ? (fieldById.get(configuration.aggregateFieldMetadataId) ?? null) : null;
  if (configuration.aggregateFieldMetadataId && !aggregateField) {
    throw new AppError('aggregateFieldMetadataId does not belong to this object', 400);
  }

  const workspaceDataSource = await workspaceDataSourceCache.getWorkspaceDataSource(workspaceId);
  const alias = object.nameSingular;
  const repo = workspaceDataSource.getRepository(alias);
  const qb = repo.createQueryBuilder(alias);

  if (configuration.filter?.length) {
    const filterable = buildFilterableFieldIndex(fields);
    applyFilterConditions(qb, alias, filterable, configuration.filter as never);
  }

  const aggregateExpr = buildAggregateExpr(alias, operation, aggregateField);
  const isAggregateOnly = configuration.configurationType === 'AGGREGATE_CHART' || !configuration.groupByFieldMetadataId;

  if (isAggregateOnly) {
    qb.select(aggregateExpr, 'value');
    const raw = await qb.getRawOne<{ value: string | null }>();
    return { data: [{ key: '', value: parseNumeric(raw?.value) }] };
  }

  const groupByField = fieldById.get(configuration.groupByFieldMetadataId!);
  if (!groupByField) throw new AppError('groupByFieldMetadataId does not belong to this object', 400);
  if (!GROUP_BY_ELIGIBLE_TYPES.has(groupByField.type)) {
    throw new AppError(`Cannot group by field type "${groupByField.type}"`, 400);
  }

  const secondaryField = configuration.secondaryGroupByFieldMetadataId
    ? (fieldById.get(configuration.secondaryGroupByFieldMetadataId) ?? null)
    : null;
  if (configuration.secondaryGroupByFieldMetadataId && !secondaryField) {
    throw new AppError('secondaryGroupByFieldMetadataId does not belong to this object', 400);
  }
  if (secondaryField && !GROUP_BY_ELIGIBLE_TYPES.has(secondaryField.type)) {
    throw new AppError(`Cannot group by field type "${secondaryField.type}"`, 400);
  }

  const groupByExpr = buildGroupByExpr(alias, groupByField, configuration.dateGranularity);
  qb.select(aggregateExpr, 'value').addSelect(groupByExpr, 'key').groupBy(groupByExpr);

  if (secondaryField) {
    const secondaryExpr = buildGroupByExpr(alias, secondaryField, configuration.secondaryDateGranularity);
    qb.addSelect(secondaryExpr, 'secondaryKey').addGroupBy(secondaryExpr);
  }

  const orderBy = resolveOrderBy(configuration.orderBy);
  if (orderBy === 'VALUE_ASC') qb.orderBy('value', 'ASC');
  else if (orderBy === 'VALUE_DESC') qb.orderBy('value', 'DESC');
  else qb.orderBy(groupByExpr, orderBy === 'FIELD_ASC' ? 'ASC' : 'DESC');
  qb.limit(200);

  const rows = await qb.getRawMany<{ key: RawKey; secondaryKey?: RawKey; value: string | null }>();
  const labelByKey = await resolveGroupLabels(
    workspaceId,
    groupByField,
    configuration.dateGranularity,
    rows.map((r) => r.key),
  );
  const secondaryLabelByKey = secondaryField
    ? await resolveGroupLabels(
        workspaceId,
        secondaryField,
        configuration.secondaryDateGranularity,
        rows.map((r) => r.secondaryKey ?? null),
      )
    : null;

  let data: ChartDataPoint[] = rows.map((r) => {
    const point: ChartDataPoint = {
      key: labelByKey.get(rawKeyToString(r.key, groupByField, configuration.dateGranularity)) ?? String(r.key ?? ''),
      value: parseNumeric(r.value),
    };
    if (secondaryField && secondaryLabelByKey) {
      point.secondaryKey =
        secondaryLabelByKey.get(rawKeyToString(r.secondaryKey ?? null, secondaryField, configuration.secondaryDateGranularity)) ??
        String(r.secondaryKey ?? '');
    }
    return point;
  });

  if (configuration.omitZeroValues || configuration.hideEmptyCategory) {
    data = data.filter((p) => p.value !== 0);
  }

  return { data };
}
