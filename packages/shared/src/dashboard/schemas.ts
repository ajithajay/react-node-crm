import { z } from 'zod';

/** Widget types a dashboard's page_layout can hold (Phase 7, Twenty parity subset). */
export const DASHBOARD_WIDGET_TYPES = ['GRAPH', 'IFRAME', 'RECORD_TABLE', 'STANDALONE_RICH_TEXT'] as const;
export type DashboardWidgetType = (typeof DASHBOARD_WIDGET_TYPES)[number];

/** A GRAPH widget's chart sub-type — carried as `configuration.configurationType`. */
export const GRAPH_TYPES = ['AGGREGATE_CHART', 'PIE_CHART', 'BAR_CHART', 'LINE_CHART'] as const;
export type GraphType = (typeof GRAPH_TYPES)[number];

export const AGGREGATE_OPERATIONS = ['COUNT', 'SUM', 'AVG', 'MIN', 'MAX'] as const;
export type AggregateOperation = (typeof AGGREGATE_OPERATIONS)[number];

/** Only meaningful when the group-by field is a DATE/DATE_TIME field. */
export const DATE_GRANULARITIES = ['DAY', 'WEEK', 'MONTH', 'QUARTER', 'YEAR'] as const;
export type DateGranularity = (typeof DATE_GRANULARITIES)[number];

export const CHART_NUMBER_FORMATS = ['SHORT', 'FULL'] as const;
export type ChartNumberFormat = (typeof CHART_NUMBER_FORMATS)[number];

export const BAR_CHART_LAYOUTS = ['VERTICAL', 'HORIZONTAL'] as const;
export type BarChartLayout = (typeof BAR_CHART_LAYOUTS)[number];

/** "Sort by" for a grouped chart's primary axis — by the group's own field value/position, or by
 * the computed aggregate value. */
export const CHART_ORDER_BY_OPTIONS = ['FIELD_ASC', 'FIELD_DESC', 'VALUE_ASC', 'VALUE_DESC'] as const;
export type ChartOrderBy = (typeof CHART_ORDER_BY_OPTIONS)[number];

/**
 * Polymorphic per-widget-type settings, stored as the widget's `configuration` jsonb — mirrors the
 * record-page `pageLayoutWidgetConfigurationSchema`'s "one big partial+passthrough object" shape
 * rather than a strict discriminated union, so a widget can be edited incrementally (e.g. changing
 * `configurationType` from PIE_CHART to BAR_CHART reuses `aggregateFieldMetadataId`/`aggregateOperation`
 * and only the axis-specific keys change).
 */
export const dashboardWidgetConfigurationSchema = z
  .object({
    // GRAPH — which chart sub-type this configuration is for.
    configurationType: z.enum(GRAPH_TYPES).optional(),
    // Shared chart fields.
    aggregateFieldMetadataId: z.string().uuid().nullable().optional(), // null = COUNT(*)
    aggregateOperation: z.enum(AGGREGATE_OPERATIONS).optional(),
    numberFormat: z.enum(CHART_NUMBER_FORMATS).optional(),
    prefix: z.string().max(10).optional(),
    suffix: z.string().max(10).optional(),
    filter: z.array(z.object({ field: z.string(), operand: z.string(), value: z.unknown().optional() })).optional(),
    // PIE_CHART / BAR_CHART / LINE_CHART group-by (primary axis — "Data on display" under X axis
    // for bar/line, or the pie's own "Data on display").
    groupByFieldMetadataId: z.string().uuid().optional(),
    dateGranularity: z.enum(DATE_GRANULARITIES).optional(),
    orderBy: z.enum(CHART_ORDER_BY_OPTIONS).optional(),
    // BAR_CHART / LINE_CHART secondary axis (2D grouping / multi-series — e.g. stage × company).
    secondaryGroupByFieldMetadataId: z.string().uuid().optional(),
    secondaryDateGranularity: z.enum(DATE_GRANULARITIES).optional(),
    layout: z.enum(BAR_CHART_LAYOUTS).optional(),
    // Bar/line "omit zero values"; pie's equivalent "hide empty category" (same effect, different label).
    omitZeroValues: z.boolean().optional(),
    hideEmptyCategory: z.boolean().optional(),
    // Y axis (bar/line) presentation range — display-only, not applied server-side.
    rangeMin: z.number().nullable().optional(),
    rangeMax: z.number().nullable().optional(),
    // Style (bar/line/pie).
    axisName: z.string().max(50).nullable().optional(),
    displayDataLabel: z.boolean().optional(),
    displayLegend: z.boolean().optional(),
    showCenterMetric: z.boolean().optional(),
    /** Index into the categorical palette to start from (a lightweight "Colors" picker — the
     * fixed-order palette itself is never reordered per the dataviz skill's CVD-safety rule). */
    colorSeed: z.number().int().min(0).optional(),
    // IFRAME
    url: z.string().url().nullable().optional(),
    // RECORD_TABLE ("View" widget)
    objectMetadataId: z.string().uuid().optional(),
    viewId: z.string().uuid().nullable().optional(),
    recordLimit: z.number().int().min(1).max(100).optional(),
    visibleFieldIds: z.array(z.string().uuid()).optional(),
    sortFieldMetadataId: z.string().uuid().nullable().optional(),
    sortDirection: z.enum(['ASC', 'DESC']).optional(),
    // STANDALONE_RICH_TEXT
    blocknote: z.unknown().optional(),
    markdown: z.string().optional(),
  })
  .partial()
  .passthrough();
export type DashboardWidgetConfiguration = z.infer<typeof dashboardWidgetConfigurationSchema>;

export const gridPositionSchema = z.object({
  row: z.number().int().min(0),
  column: z.number().int().min(0),
  rowSpan: z.number().int().min(1),
  columnSpan: z.number().int().min(1),
});
export type GridPosition = z.infer<typeof gridPositionSchema>;

// ---- Save request (bulk-replace, mirrors savePageLayoutRequestSchema) ----

export const dashboardWidgetSchema = z.object({
  id: z.string().uuid().optional(),
  type: z.enum(DASHBOARD_WIDGET_TYPES),
  title: z.string().trim().min(1).max(100),
  /** The object this widget reads (nullable — IFRAME/STANDALONE_RICH_TEXT have none). */
  objectMetadataId: z.string().uuid().nullable().optional(),
  isVisible: z.boolean().default(true),
  gridPosition: gridPositionSchema,
  configuration: dashboardWidgetConfigurationSchema.optional(),
});
export type DashboardWidgetInput = z.infer<typeof dashboardWidgetSchema>;

export const dashboardTabSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(100),
  isVisible: z.boolean().default(true),
  isPinned: z.boolean().default(false),
  widgets: z.array(dashboardWidgetSchema),
});
export type DashboardTabInput = z.infer<typeof dashboardTabSchema>;

export const saveDashboardLayoutRequestSchema = z.object({
  tabs: z.array(dashboardTabSchema),
});
export type SaveDashboardLayoutRequest = z.infer<typeof saveDashboardLayoutRequestSchema>;

export const createDashboardRequestSchema = z.object({
  title: z.string().trim().min(1).max(100),
});
export type CreateDashboardRequest = z.infer<typeof createDashboardRequestSchema>;

export const updateDashboardRequestSchema = z.object({
  title: z.string().trim().min(1).max(100),
});
export type UpdateDashboardRequest = z.infer<typeof updateDashboardRequestSchema>;

// ---- Response DTOs ----

export interface DashboardWidgetDto {
  id: string;
  type: DashboardWidgetType;
  title: string;
  objectMetadataId: string | null;
  isVisible: boolean;
  gridPosition: GridPosition;
  configuration: DashboardWidgetConfiguration;
}

export interface DashboardTabDto {
  id: string;
  title: string;
  isVisible: boolean;
  isPinned: boolean;
  widgets: DashboardWidgetDto[];
}

export interface DashboardSummary {
  id: string;
  title: string;
  position: number;
  updatedAt: string;
}

export interface DashboardDetail extends DashboardSummary {
  pageLayoutId: string;
  tabs: DashboardTabDto[];
}

// ---- Chart data ----

export const chartDataRequestSchema = z.object({
  objectMetadataId: z.string().uuid(),
  configuration: dashboardWidgetConfigurationSchema,
});
export type ChartDataRequest = z.infer<typeof chartDataRequestSchema>;

export interface ChartDataPoint {
  key: string;
  value: number;
  secondaryKey?: string;
}

export interface ChartDataResponse {
  /** AGGREGATE_CHART returns a single point with key "" (or a group set for the pie/bar/line types). */
  data: ChartDataPoint[];
}
