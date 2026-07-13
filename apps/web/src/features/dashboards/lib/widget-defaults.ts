import type { BarChartLayout, ChartOrderBy, DashboardWidgetType, GraphType } from '@/lib/api-client';
import { BarChart3, BarChartHorizontal, Frame, Hash, LayoutGrid, LineChart, PieChart, Sigma, Table2, Type } from 'lucide-react';

export const DASHBOARD_GRID_COLUMNS = 12;
export const DASHBOARD_GRID_ROW_HEIGHT = 32;
export const DASHBOARD_GRID_MARGIN = 12;

/** Default grid size (columns × rows) per widget type, and per graph sub-type for GRAPH widgets —
 * mirrors Twenty's `GraphWidgetSizes`/`WidgetSizes` constants, scaled to our 12-column grid. */
export const WIDGET_DEFAULT_SIZE: Record<DashboardWidgetType, { w: number; h: number }> = {
  GRAPH: { w: 6, h: 6 },
  IFRAME: { w: 6, h: 6 },
  RECORD_TABLE: { w: 6, h: 6 },
  STANDALONE_RICH_TEXT: { w: 4, h: 4 },
};

export const GRAPH_TYPE_DEFAULT_SIZE: Record<GraphType, { w: number; h: number }> = {
  AGGREGATE_CHART: { w: 3, h: 3 },
  PIE_CHART: { w: 4, h: 5 },
  BAR_CHART: { w: 6, h: 6 },
  LINE_CHART: { w: 6, h: 6 },
};

export const GRAPH_TYPE_LABELS: Record<GraphType, string> = {
  AGGREGATE_CHART: 'Number',
  PIE_CHART: 'Pie chart',
  BAR_CHART: 'Bar chart',
  LINE_CHART: 'Line chart',
};

export const GRAPH_TYPE_ICONS: Record<GraphType, typeof PieChart> = {
  AGGREGATE_CHART: Hash,
  PIE_CHART: PieChart,
  BAR_CHART: BarChart3,
  LINE_CHART: LineChart,
};

/** The sidebar's quick chart-type switcher splits BAR_CHART into its two `layout` variants as
 * distinct icon buttons (Twenty parity) even though both persist as `configurationType: BAR_CHART`
 * + a different `layout` value. */
export interface ChartQuickType {
  key: string;
  graphType: GraphType;
  layout?: BarChartLayout;
  label: string;
  icon: typeof PieChart;
}
export const CHART_QUICK_TYPES: ChartQuickType[] = [
  { key: 'BAR_VERTICAL', graphType: 'BAR_CHART', layout: 'VERTICAL', label: 'Vertical bar chart', icon: BarChart3 },
  { key: 'BAR_HORIZONTAL', graphType: 'BAR_CHART', layout: 'HORIZONTAL', label: 'Horizontal bar chart', icon: BarChartHorizontal },
  { key: 'LINE_CHART', graphType: 'LINE_CHART', label: 'Line chart', icon: LineChart },
  { key: 'PIE_CHART', graphType: 'PIE_CHART', label: 'Pie chart', icon: PieChart },
  { key: 'AGGREGATE_CHART', graphType: 'AGGREGATE_CHART', label: 'Number', icon: Sigma },
];

export const CHART_ORDER_BY_LABELS: Record<ChartOrderBy, string> = {
  FIELD_ASC: 'Field, ascending',
  FIELD_DESC: 'Field, descending',
  VALUE_ASC: 'Value, ascending',
  VALUE_DESC: 'Value, descending',
};

export const WIDGET_TYPE_LABELS: Record<DashboardWidgetType, string> = {
  GRAPH: 'Chart',
  IFRAME: 'iFrame',
  RECORD_TABLE: 'View',
  STANDALONE_RICH_TEXT: 'Rich text',
};

export const WIDGET_TYPE_ICONS: Record<DashboardWidgetType, typeof LayoutGrid> = {
  GRAPH: PieChart,
  IFRAME: Frame,
  RECORD_TABLE: Table2,
  STANDALONE_RICH_TEXT: Type,
};

/** Compact-number formatting for the AGGREGATE_CHART widget's "Number" display. */
export function formatChartNumber(value: number, format: 'SHORT' | 'FULL' | undefined): string {
  if (format === 'SHORT') {
    const abs = Math.abs(value);
    if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1).replace(/\.0$/, '')}B`;
    if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
    if (abs >= 1_000) return `${(value / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  }
  return new Intl.NumberFormat().format(Math.round(value * 100) / 100);
}
