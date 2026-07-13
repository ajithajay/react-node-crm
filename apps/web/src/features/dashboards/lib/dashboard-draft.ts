import type {
  DashboardDetail,
  DashboardTab,
  DashboardWidget,
  DashboardWidgetType,
  GridPosition,
  DashboardWidgetConfiguration,
} from '@/lib/api-client';

/** Pure mutation helpers over a `DashboardDetail` draft (mirrors `page-layout-draft.ts`'s style) —
 * each returns a new dashboard, never mutates in place. Multi-tab aware: every helper takes the
 * target tab's id, same as the record-page layout editor. */

let tempIdCounter = 0;
export function makeTempId(prefix: string): string {
  tempIdCounter += 1;
  return `new-${prefix}-${tempIdCounter}`;
}

export function widgetsOf(dashboard: DashboardDetail, tabId: string): DashboardWidget[] {
  return dashboard.tabs.find((t) => t.id === tabId)?.widgets ?? [];
}

export function updateTab(dashboard: DashboardDetail, tabId: string, updater: (t: DashboardTab) => DashboardTab): DashboardDetail {
  return { ...dashboard, tabs: dashboard.tabs.map((t) => (t.id === tabId ? updater(t) : t)) };
}

export function updateWidget(
  dashboard: DashboardDetail,
  tabId: string,
  widgetId: string,
  updater: (w: DashboardWidget) => DashboardWidget,
): DashboardDetail {
  return updateTab(dashboard, tabId, (t) => ({
    ...t,
    widgets: t.widgets.map((w) => (w.id === widgetId ? updater(w) : w)),
  }));
}

export function deleteWidget(dashboard: DashboardDetail, tabId: string, widgetId: string): DashboardDetail {
  return updateTab(dashboard, tabId, (t) => ({ ...t, widgets: t.widgets.filter((w) => w.id !== widgetId) }));
}

/** Places a new widget just below the lowest occupied row (full-bleed vertical stacking — the user
 * drags it wherever they actually want after adding). Used when no drag-selected rect is available. */
export function nextGridPosition(widgets: DashboardWidget[], size: { w: number; h: number }): GridPosition {
  const nextRow = widgets.reduce((max, w) => Math.max(max, w.gridPosition.row + w.gridPosition.rowSpan), 0);
  return { row: nextRow, column: 0, rowSpan: size.h, columnSpan: size.w };
}

export function addWidget(
  dashboard: DashboardDetail,
  tabId: string,
  type: DashboardWidgetType,
  title: string,
  gridPosition: GridPosition,
  configuration: DashboardWidgetConfiguration = {},
  objectMetadataId: string | null = null,
): DashboardDetail {
  return updateTab(dashboard, tabId, (t) => ({
    ...t,
    widgets: [
      ...t.widgets,
      { id: makeTempId('widget'), type, title, objectMetadataId, isVisible: true, gridPosition, configuration },
    ],
  }));
}

/** Applies a batch of grid-position changes from a drag/resize stop event. */
export function applyGridPositions(dashboard: DashboardDetail, tabId: string, positions: Map<string, GridPosition>): DashboardDetail {
  return updateTab(dashboard, tabId, (t) => ({
    ...t,
    widgets: t.widgets.map((w) => {
      const next = positions.get(w.id);
      return next ? { ...w, gridPosition: next } : w;
    }),
  }));
}

export function addTab(dashboard: DashboardDetail, title: string): DashboardDetail {
  return {
    ...dashboard,
    tabs: [...dashboard.tabs, { id: makeTempId('tab'), title, isVisible: true, isPinned: dashboard.tabs.length === 0, widgets: [] }],
  };
}

export function renameTab(dashboard: DashboardDetail, tabId: string, title: string): DashboardDetail {
  return updateTab(dashboard, tabId, (t) => ({ ...t, title }));
}

export function deleteTab(dashboard: DashboardDetail, tabId: string): DashboardDetail {
  return { ...dashboard, tabs: dashboard.tabs.filter((t) => t.id !== tabId) };
}
