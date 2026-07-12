import type { PageLayout, PageLayoutTab, PageLayoutWidget, PageLayoutWidgetType } from '@/lib/api-client';
import { makeTempId } from '@/features/layout-customization/LayoutCustomizationContext';

/** Pure mutation helpers over a `PageLayout` draft — each returns a new layout, never mutates in place. */

export function updateTab(layout: PageLayout, tabId: string, updater: (t: PageLayoutTab) => PageLayoutTab): PageLayout {
  return { ...layout, tabs: layout.tabs.map((t) => (t.id === tabId ? updater(t) : t)) };
}

export function updateWidget(
  layout: PageLayout,
  tabId: string,
  widgetId: string,
  updater: (w: PageLayoutWidget) => PageLayoutWidget,
): PageLayout {
  return updateTab(layout, tabId, (t) => ({
    ...t,
    widgets: t.widgets.map((w) => (w.id === widgetId ? updater(w) : w)),
  }));
}

export function moveWidget(layout: PageLayout, tabId: string, widgetId: string, dir: -1 | 1): PageLayout {
  return updateTab(layout, tabId, (t) => {
    const idx = t.widgets.findIndex((w) => w.id === widgetId);
    const j = idx + dir;
    if (idx < 0 || j < 0 || j >= t.widgets.length) return t;
    const widgets = [...t.widgets];
    [widgets[idx], widgets[j]] = [widgets[j]!, widgets[idx]!];
    return { ...t, widgets };
  });
}

export function moveWidgetToTab(layout: PageLayout, fromTabId: string, widgetId: string, toTabId: string): PageLayout {
  const fromTab = layout.tabs.find((t) => t.id === fromTabId);
  const widget = fromTab?.widgets.find((w) => w.id === widgetId);
  if (!widget) return layout;
  return {
    ...layout,
    tabs: layout.tabs.map((t) => {
      if (t.id === fromTabId) return { ...t, widgets: t.widgets.filter((w) => w.id !== widgetId) };
      if (t.id === toTabId) return { ...t, widgets: [...t.widgets, widget] };
      return t;
    }),
  };
}

export function deleteWidget(layout: PageLayout, tabId: string, widgetId: string): PageLayout {
  return updateTab(layout, tabId, (t) => ({ ...t, widgets: t.widgets.filter((w) => w.id !== widgetId) }));
}

export function addWidget(
  layout: PageLayout,
  tabId: string,
  type: PageLayoutWidgetType,
  title: string,
  configuration: Record<string, unknown> = {},
): PageLayout {
  return updateTab(layout, tabId, (t) => ({
    ...t,
    widgets: [
      ...t.widgets,
      { id: makeTempId('widget'), type, title, position: t.widgets.length, isVisible: true, configuration, groups: [] },
    ],
  }));
}

export function addTab(layout: PageLayout, title: string): PageLayout {
  return {
    ...layout,
    tabs: [
      ...layout.tabs,
      { id: makeTempId('tab'), title, icon: null, position: layout.tabs.length, isVisible: true, isPinned: false, widgets: [] },
    ],
  };
}

export function deleteTab(layout: PageLayout, tabId: string): PageLayout {
  return { ...layout, tabs: layout.tabs.filter((t) => t.id !== tabId) };
}

export function renameTab(layout: PageLayout, tabId: string, title: string): PageLayout {
  return updateTab(layout, tabId, (t) => ({ ...t, title }));
}

export function pinTab(layout: PageLayout, tabId: string): PageLayout {
  return { ...layout, tabs: layout.tabs.map((t) => ({ ...t, isPinned: t.id === tabId })) };
}

export function moveTab(layout: PageLayout, tabId: string, dir: -1 | 1): PageLayout {
  const idx = layout.tabs.findIndex((t) => t.id === tabId);
  const j = idx + dir;
  if (idx < 0 || j < 0 || j >= layout.tabs.length) return layout;
  const tabs = [...layout.tabs];
  [tabs[idx], tabs[j]] = [tabs[j]!, tabs[idx]!];
  return { ...layout, tabs };
}

// ---- FIELDS widget group/field mutations (operate on a single widget) ----

export function addGroup(widget: PageLayoutWidget): PageLayoutWidget {
  return {
    ...widget,
    groups: [...widget.groups, { id: makeTempId('group'), label: 'New group', isVisible: true, position: widget.groups.length, fields: [] }],
  };
}

export function updateGroup(
  widget: PageLayoutWidget,
  groupId: string,
  updater: (g: PageLayoutWidget['groups'][number]) => PageLayoutWidget['groups'][number],
): PageLayoutWidget {
  return { ...widget, groups: widget.groups.map((g) => (g.id === groupId ? updater(g) : g)) };
}

export function deleteGroup(widget: PageLayoutWidget, groupId: string): PageLayoutWidget {
  return { ...widget, groups: widget.groups.filter((g) => g.id !== groupId) };
}

export function reorderGroups(widget: PageLayoutWidget, fromId: string, toId: string): PageLayoutWidget {
  const groups = [...widget.groups];
  const fromIdx = groups.findIndex((g) => g.id === fromId);
  const toIdx = groups.findIndex((g) => g.id === toId);
  if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return widget;
  const [moved] = groups.splice(fromIdx, 1);
  groups.splice(toIdx, 0, moved!);
  return { ...widget, groups };
}

/** Move a field to a target group at a given index (same group = reorder; different group = relocate). */
export function moveField(
  widget: PageLayoutWidget,
  fieldId: string,
  targetGroupId: string,
  targetIndex: number,
): PageLayoutWidget {
  const sourceGroup = widget.groups.find((g) => g.fields.some((f) => f.fieldMetadataId === fieldId));
  const field = sourceGroup?.fields.find((f) => f.fieldMetadataId === fieldId);
  if (!field) return widget;

  const groups = widget.groups.map((g) => {
    if (g.id === sourceGroup!.id && g.id !== targetGroupId) {
      return { ...g, fields: g.fields.filter((f) => f.fieldMetadataId !== fieldId) };
    }
    return g;
  });
  return {
    ...widget,
    groups: groups.map((g) => {
      if (g.id !== targetGroupId) return g;
      const withoutField = g.fields.filter((f) => f.fieldMetadataId !== fieldId);
      const next = [...withoutField];
      next.splice(Math.min(targetIndex, next.length), 0, field);
      return { ...g, fields: next };
    }),
  };
}
