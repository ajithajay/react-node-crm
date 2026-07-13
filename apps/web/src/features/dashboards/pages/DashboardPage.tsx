import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Pencil, Plus, X } from 'lucide-react';
import {
  dashboardApi,
  type DashboardDetail,
  type DashboardWidgetType,
  type GraphType,
  type GridPosition,
} from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { DashboardGrid } from '../components/DashboardGrid';
import { WidgetCard } from '../components/WidgetCard';
import { WidgetRenderer } from '../components/WidgetRenderer';
import { AddWidgetDialog } from '../components/AddWidgetDialog';
import { WidgetConfigPanel } from '../components/WidgetConfigPanel';
import {
  addTab,
  addWidget,
  applyGridPositions,
  deleteTab,
  deleteWidget,
  nextGridPosition,
  renameTab,
  updateWidget,
  widgetsOf,
} from '../lib/dashboard-draft';
import { GRAPH_TYPE_DEFAULT_SIZE, GRAPH_TYPE_LABELS, WIDGET_DEFAULT_SIZE, WIDGET_TYPE_LABELS } from '../lib/widget-defaults';

export function DashboardPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: dashboard, isLoading } = useQuery({
    queryKey: ['dashboard', id],
    queryFn: () => dashboardApi.get(id!),
    enabled: !!id,
  });

  const [editMode, setEditMode] = useState(false);
  const [draft, setDraft] = useState<DashboardDetail | null>(null);
  const [title, setTitle] = useState('');
  const [editingWidgetId, setEditingWidgetId] = useState<string | null>(null);
  const [selectedTabId, setSelectedTabId] = useState<string | null>(null);
  const [renamingTabId, setRenamingTabId] = useState<string | null>(null);
  const [renamingTabTitle, setRenamingTabTitle] = useState('');
  const [addWidgetOpen, setAddWidgetOpen] = useState(false);
  const [pendingPosition, setPendingPosition] = useState<GridPosition | null>(null);

  useEffect(() => {
    if (dashboard) setTitle(dashboard.title);
  }, [dashboard]);

  const saveMutation = useMutation({
    mutationFn: () =>
      dashboardApi.saveLayout(id!, {
        tabs: draft!.tabs.map((tab) => ({
          ...tab,
          id: tab.id.startsWith('new-') ? undefined : tab.id,
          widgets: tab.widgets.map((w) => ({ ...w, id: w.id.startsWith('new-') ? undefined : w.id })),
        })),
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(['dashboard', id], updated);
      setEditMode(false);
      setDraft(null);
      setEditingWidgetId(null);
      setSelectedTabId(null);
    },
  });

  const renameMutation = useMutation({
    mutationFn: (t: string) => dashboardApi.update(id!, t),
    onSuccess: (updated) => {
      queryClient.setQueryData(['dashboard', id], updated);
      void queryClient.invalidateQueries({ queryKey: ['dashboards'] });
    },
  });

  if (isLoading || !dashboard) {
    return (
      <div className="flex flex-col gap-4 p-6">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const active = editMode ? (draft ?? dashboard) : dashboard;
  const activeTabId = selectedTabId ?? active.tabs[0]?.id ?? '';
  const widgets = widgetsOf(active, activeTabId);
  const editingWidget = widgets.find((w) => w.id === editingWidgetId) ?? null;

  function enterEditMode(): void {
    setDraft(dashboard!);
    setEditMode(true);
  }

  function cancelEditMode(): void {
    setDraft(null);
    setEditMode(false);
    setEditingWidgetId(null);
    setSelectedTabId(null);
  }

  function openAddWidget(position: GridPosition | null): void {
    setPendingPosition(position);
    setAddWidgetOpen(true);
  }

  function handleAddWidget(type: DashboardWidgetType, graphType?: GraphType): void {
    if (!draft) return;
    const size = type === 'GRAPH' && graphType ? GRAPH_TYPE_DEFAULT_SIZE[graphType] : WIDGET_DEFAULT_SIZE[type];
    // A plain click (no real drag) reports a 1×1 rect — use the widget type's own default size at
    // that origin instead of literally creating a 1×1 widget. A genuine drag keeps its exact size.
    const isPlainClick = pendingPosition && pendingPosition.rowSpan <= 1 && pendingPosition.columnSpan <= 1;
    const gridPosition = pendingPosition
      ? isPlainClick
        ? { row: pendingPosition.row, column: pendingPosition.column, rowSpan: size.h, columnSpan: size.w }
        : pendingPosition
      : nextGridPosition(widgetsOf(draft, activeTabId), size);
    setPendingPosition(null);
    const title = type === 'GRAPH' && graphType ? GRAPH_TYPE_LABELS[graphType] : WIDGET_TYPE_LABELS[type];
    const configuration = type === 'GRAPH' ? { configurationType: graphType } : {};
    const next = addWidget(draft, activeTabId, type, title, gridPosition, configuration);
    setDraft(next);
    const added = widgetsOf(next, activeTabId).at(-1);
    if (added) setEditingWidgetId(added.id);
  }

  function handleGridChange(positions: Map<string, GridPosition>): void {
    if (!draft) return;
    setDraft(applyGridPositions(draft, activeTabId, positions));
  }

  function handleDeleteWidget(widgetId: string): void {
    if (!draft) return;
    setDraft(deleteWidget(draft, activeTabId, widgetId));
    if (editingWidgetId === widgetId) setEditingWidgetId(null);
  }

  function handleAddTab(): void {
    if (!draft) return;
    const next = addTab(draft, `Tab ${draft.tabs.length + 1}`);
    setDraft(next);
    setSelectedTabId(next.tabs.at(-1)!.id);
  }

  function handleDeleteTab(tabId: string): void {
    if (!draft || draft.tabs.length <= 1) return;
    const next = deleteTab(draft, tabId);
    setDraft(next);
    if (activeTabId === tabId) setSelectedTabId(next.tabs[0]?.id ?? null);
  }

  function submitTabRename(): void {
    if (draft && renamingTabId && renamingTabTitle.trim()) {
      setDraft(renameTab(draft, renamingTabId, renamingTabTitle.trim()));
    }
    setRenamingTabId(null);
  }

  function handleRenameSubmit(): void {
    if (title.trim() && title !== dashboard?.title) renameMutation.mutate(title.trim());
  }

  return (
    <div className="flex h-full">
      <div className="flex min-w-0 flex-1 flex-col gap-4 overflow-y-auto p-6">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <Button variant="ghost" size="icon-sm" onClick={() => navigate('/dashboards')} aria-label="Back to dashboards">
              <ArrowLeft className="size-4" />
            </Button>
            {editMode ? (
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={handleRenameSubmit}
                className="h-8 max-w-sm text-lg font-semibold"
              />
            ) : (
              <h1 className="truncate text-2xl font-semibold">{dashboard.title}</h1>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {editMode ? (
              <>
                <Button size="sm" onClick={() => openAddWidget(null)}>
                  <Plus className="size-4" />
                  Add widget
                </Button>
                <Button variant="ghost" onClick={cancelEditMode}>
                  Cancel
                </Button>
                <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                  Save
                </Button>
              </>
            ) : (
              <Button variant="outline" onClick={enterEditMode}>
                <Pencil className="size-4" />
                Edit
              </Button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 border-b">
          {active.tabs.map((tab) => (
            <div key={tab.id} className="group flex items-center">
              {renamingTabId === tab.id ? (
                <Input
                  autoFocus
                  value={renamingTabTitle}
                  onChange={(e) => setRenamingTabTitle(e.target.value)}
                  onBlur={submitTabRename}
                  onKeyDown={(e) => e.key === 'Enter' && submitTabRename()}
                  className="h-7 w-28"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setSelectedTabId(tab.id)}
                  onDoubleClick={() => {
                    if (!editMode) return;
                    setRenamingTabId(tab.id);
                    setRenamingTabTitle(tab.title);
                  }}
                  className={`border-b-2 px-3 py-2 text-sm ${tab.id === activeTabId ? 'border-foreground font-medium' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                >
                  {tab.title}
                </button>
              )}
              {editMode && tab.id === activeTabId && active.tabs.length > 1 && (
                <button
                  type="button"
                  onClick={() => handleDeleteTab(tab.id)}
                  className="mr-1 hidden text-muted-foreground hover:text-foreground group-hover:inline"
                  aria-label="Delete tab"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
          ))}
          {editMode && (
            <button
              type="button"
              onClick={handleAddTab}
              className="flex items-center gap-1 px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
            >
              <Plus className="size-3.5" />
              New Tab
            </button>
          )}
        </div>

        {widgets.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-16 text-center text-muted-foreground">
            <p>This dashboard has no widgets yet.</p>
            {editMode && (
              <Button size="sm" onClick={() => openAddWidget(null)}>
                <Plus className="size-4" />
                Add widget
              </Button>
            )}
          </div>
        ) : (
          <DashboardGrid
            widgets={widgets}
            editMode={editMode}
            onLayoutChange={handleGridChange}
            onAreaSelected={openAddWidget}
            renderWidget={(widget) => (
              <WidgetCard
                widget={widget}
                editMode={editMode}
                onEdit={() => setEditingWidgetId(widget.id)}
                onDelete={() => handleDeleteWidget(widget.id)}
              >
                <WidgetRenderer
                  widget={widget}
                  editMode={editMode}
                  onRichTextChange={(value) => {
                    if (!draft) return;
                    setDraft(
                      updateWidget(draft, activeTabId, widget.id, (w) => ({
                        ...w,
                        configuration: { ...w.configuration, blocknote: value.blocknote, markdown: value.markdown ?? undefined },
                      })),
                    );
                  }}
                />
              </WidgetCard>
            )}
          />
        )}
      </div>

      {editMode && editingWidget && (
        <WidgetConfigPanel
          widget={editingWidget}
          onClose={() => setEditingWidgetId(null)}
          onUpdate={(updater) => draft && setDraft(updateWidget(draft, activeTabId, editingWidget.id, updater))}
        />
      )}

      <AddWidgetDialog open={addWidgetOpen} onOpenChange={setAddWidgetOpen} onAdd={handleAddWidget} />
    </div>
  );
}
