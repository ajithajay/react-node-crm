import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ChevronDown, Plus } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ApiError,
  type DataModelField,
  type PageLayout,
  type PageLayoutWidget,
  type PageLayoutWidgetType,
  dataModelApi,
  recordApi,
} from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { FieldInput, isEditableField, isReverseRelationField } from '../lib/field-inputs';
import { friendlyFieldKey, resolveRecordLabel } from '../lib/field-values';
import * as draft from '../lib/page-layout-draft';
import { RecordAttachmentsWidget } from '../components/RecordAttachmentsWidget';
import { RecordChip } from '../components/RecordChip';
import { RecordJunctionWidget } from '../components/RecordJunctionWidget';
import { RecordRelationWidget } from '../components/RecordRelationWidget';
import { RecordTimelineWidget } from '../components/RecordTimelineWidget';
import { Tag } from '../components/Tag';
import { WidgetEditPanel } from '../components/record-layout-editor/WidgetEditPanel';
import { TabEditPanel } from '../components/record-layout-editor/TabEditPanel';
import { AddWidgetPanel } from '../components/record-layout-editor/AddWidgetPanel';
import { getIcon } from '@/lib/icons';
import { useLayoutCustomization } from '@/features/layout-customization/LayoutCustomizationContext';

const SYSTEM_FIELD_NAMES: ReadonlySet<string> = new Set([
  'created_at',
  'updated_at',
  'deleted_at',
  'created_by',
  'updated_by',
]);

const SINGLETON_WIDGET_TYPES: PageLayoutWidgetType[] = ['FIELDS', 'TIMELINE', 'NOTES', 'TASKS', 'FILES'];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="rounded-lg border bg-card">
      <button
        type="button"
        className="flex w-full items-center gap-1 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
        onClick={() => setOpen((o) => !o)}
      >
        {title}
        <ChevronDown className={cn('size-4 transition-transform', !open && '-rotate-90')} />
      </button>
      {open && <div className="space-y-4 border-t px-4 py-4">{children}</div>}
    </div>
  );
}

const READ_ONLY_TYPES: ReadonlySet<string> = new Set(['ACTOR']);

/** Read-only display for a system/audit field (created_at, created_by, …). */
function ReadOnlyFieldRow({ field, record }: { field: DataModelField; record: Record<string, unknown> }) {
  const value = record[friendlyFieldKey(field)];
  const display =
    field.type === 'ACTOR'
      ? String((value as Record<string, unknown> | null)?.name || '—')
      : value
        ? new Date(value as string).toLocaleString()
        : '—';
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{field.label}</span>
      <span>{display}</span>
    </div>
  );
}

/** A single FIELD widget — a collection relation (People/Opportunities) or one field per display mode. */
function FieldWidget({
  widget,
  fields,
  recordId,
  values,
  onChange,
}: {
  widget: PageLayoutWidget;
  fields: DataModelField[];
  recordId: string;
  values: Record<string, unknown>;
  onChange: React.Dispatch<React.SetStateAction<Record<string, unknown>>>;
}) {
  const field = fields.find((f) => f.id === widget.configuration.fieldMetadataId);
  if (!field) return null;

  // A collection/reverse relation renders the linked-records widget (add/remove/link).
  if (isReverseRelationField(field)) {
    return <RecordRelationWidget field={field} sourceRecordId={recordId} />;
  }

  const key = friendlyFieldKey(field);
  const mode = widget.configuration.displayMode ?? 'PLAIN';
  const options = (field.settings?.options as { value: string; label: string; color: string }[] | undefined) ?? [];
  const value = values[key];

  if (mode === 'CHIP_LIST' && Array.isArray(value)) {
    return (
      <div>
        <Label>{field.label}</Label>
        <div className="mt-1 flex flex-wrap gap-1">
          {value.map((v) => {
            const opt = options.find((o) => o.value === v);
            return <Tag key={String(v)} label={opt?.label ?? String(v)} color={opt?.color} />;
          })}
        </div>
      </div>
    );
  }

  const inner = (
    <div>
      <Label>{field.label}</Label>
      <div className="mt-1">
        <FieldInput field={field} value={value} onChange={(v) => onChange((p) => ({ ...p, [key]: v }))} />
      </div>
    </div>
  );

  if (mode === 'CARD') return <div className="rounded-lg border p-3">{inner}</div>;
  if (mode === 'TABLE') {
    return (
      <div className="flex items-center gap-3 border-b py-1.5 text-sm">
        <span className="w-32 shrink-0 text-muted-foreground">{field.label}</span>
        <div className="flex-1">
          <FieldInput field={field} value={value} onChange={(v) => onChange((p) => ({ ...p, [key]: v }))} />
        </div>
      </div>
    );
  }
  return inner;
}

/** The activity widgets (Timeline/Notes/Tasks/Files) render straight from the record's morph relations. */
function ActivityWidget({
  widget,
  objectNameSingular,
  recordId,
}: {
  widget: PageLayoutWidget;
  objectNameSingular: string;
  recordId: string;
}) {
  switch (widget.type) {
    case 'TIMELINE':
      return <RecordTimelineWidget sourceObjectNameSingular={objectNameSingular} sourceRecordId={recordId} />;
    case 'NOTES':
      return (
        <RecordJunctionWidget
          title="Notes"
          junctionObjectNamePlural="note_targets"
          itemObjectNamePlural="notes"
          itemForwardKey="noteId"
          itemLabelKey="title"
          sourceObjectNameSingular={objectNameSingular}
          sourceRecordId={recordId}
        />
      );
    case 'TASKS':
      return (
        <RecordJunctionWidget
          title="Tasks"
          junctionObjectNamePlural="task_targets"
          itemObjectNamePlural="tasks"
          itemForwardKey="taskId"
          itemLabelKey="title"
          sourceObjectNameSingular={objectNameSingular}
          sourceRecordId={recordId}
        />
      );
    case 'FILES':
      return <RecordAttachmentsWidget sourceObjectNameSingular={objectNameSingular} sourceRecordId={recordId} />;
    default:
      return null;
  }
}

/**
 * The FIELDS widget: named field groups from the page layout (General/Business/Contact/System …).
 * Each field renders editable (FieldInput) or read-only (system/audit fields) inline — nothing is
 * rendered outside the widget system; relations are their own FIELD widgets.
 */
function FieldsWidget({
  widget,
  fields,
  record,
  values,
  onChange,
}: {
  widget: PageLayoutWidget;
  fields: DataModelField[];
  record: Record<string, unknown>;
  values: Record<string, unknown>;
  onChange: React.Dispatch<React.SetStateAction<Record<string, unknown>>>;
}) {
  const fieldById = new Map(fields.map((f) => [f.id, f]));

  return (
    <div className="space-y-4">
      {widget.groups
        .filter((g) => g.isVisible)
        .map((group) => {
          const groupFields = group.fields
            .filter((gf) => gf.isVisible)
            .map((gf) => fieldById.get(gf.fieldMetadataId))
            .filter((f): f is DataModelField => !!f);
          if (!groupFields.length) return null;
          return (
            <Section key={group.id} title={group.label}>
              {groupFields.map((field) => {
                const editable = isEditableField(field) && !READ_ONLY_TYPES.has(field.type) && !SYSTEM_FIELD_NAMES.has(field.name);
                if (!editable) return <ReadOnlyFieldRow key={field.id} field={field} record={record} />;
                const key = friendlyFieldKey(field);
                return (
                  <div key={field.id}>
                    <Label>{field.label}</Label>
                    <div className="mt-1">
                      <FieldInput field={field} value={values[key]} onChange={(v) => onChange((p) => ({ ...p, [key]: v }))} />
                    </div>
                  </div>
                );
              })}
            </Section>
          );
        })}
    </div>
  );
}

/** Wraps a widget with a click-to-edit overlay while the layout customizer is active. */
function EditableWidget({ isEditing, onClick, children }: { isEditing: boolean; onClick: () => void; children: React.ReactNode }) {
  if (!isEditing) return <>{children}</>;
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onClick();
      }}
      className="w-full cursor-pointer rounded-lg text-left ring-offset-2 transition-shadow hover:ring-2 hover:ring-primary/40 focus:outline-none"
    >
      <div className="pointer-events-none">{children}</div>
    </div>
  );
}

/**
 * Full-page record view (Twenty's record show page): a static left column (Fields/Field widgets +
 * relation widgets) and a right-side tab strip (Timeline/Notes/Tasks/Files + any custom tabs). The
 * layout customizer edits this page's tabs/widgets/field-groups in place: clicking a widget or tab
 * (while customizing) opens its right-side settings panel — the same pattern as sidebar customization.
 */
export function RecordDetailPage() {
  const { objectNamePlural, recordId } = useParams<{ objectNamePlural: string; recordId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { pageLayout, enterPageLayoutMode, setPageLayoutDraft } = useLayoutCustomization();

  const { data: objectSummary } = useQuery({ queryKey: ['data-model-objects'], queryFn: () => dataModelApi.listObjects() });
  const objectId = objectSummary?.find((o) => o.namePlural === objectNamePlural)?.id;

  const { data: detail } = useQuery({
    queryKey: ['data-model-object', objectId],
    queryFn: () => dataModelApi.getObject(objectId!),
    enabled: !!objectId,
  });

  const { data: fetchedLayout } = useQuery({
    queryKey: ['page-layout', objectId],
    queryFn: () => dataModelApi.getPageLayout(objectId!),
    enabled: !!objectId,
  });

  const { data: record } = useQuery({
    queryKey: ['record', objectNamePlural, recordId],
    queryFn: () => recordApi.get(objectNamePlural!, recordId!),
    enabled: !!objectNamePlural && !!recordId,
  });

  const isEditingLayout = !!objectId && pageLayout?.objectId === objectId;
  const requestedCustomize = searchParams.get('customize') === '1';
  const enteredRef = useRef(false);

  useEffect(() => {
    if (requestedCustomize && objectId && detail && fetchedLayout && !isEditingLayout && !enteredRef.current) {
      enteredRef.current = true;
      enterPageLayoutMode(objectId, detail.object.labelPlural, fetchedLayout);
    }
  }, [requestedCustomize, objectId, detail, fetchedLayout, isEditingLayout, enterPageLayoutMode]);

  const layout: PageLayout | undefined = isEditingLayout ? pageLayout!.draft : fetchedLayout;

  const [values, setValues] = useState<Record<string, unknown>>({});
  const [error, setError] = useState<string | null>(null);
  const originalRef = useRef<string>('{}');

  useEffect(() => {
    if (record) {
      setValues(record);
      originalRef.current = JSON.stringify(record);
    }
  }, [record]);

  const isDirty = useMemo(() => JSON.stringify(values) !== originalRef.current, [values]);

  const saveMutation = useMutation({
    mutationFn: () => recordApi.update(objectNamePlural!, recordId!, values),
    onSuccess: (updated) => {
      originalRef.current = JSON.stringify(updated);
      setValues(updated);
      queryClient.invalidateQueries({ queryKey: ['record', objectNamePlural, recordId] });
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Failed to save'),
  });

  const resetWidgetMutation = useMutation({
    mutationFn: (widgetId: string) => dataModelApi.resetPageLayoutWidget(objectId!, widgetId),
    onSuccess: (fresh, widgetId) => {
      // Merge just the reset widget's fresh server state into the current draft, preserving any
      // other pending edits rather than blowing away the whole draft.
      const freshWidget = fresh.tabs.flatMap((t) => t.widgets).find((w) => w.id === widgetId);
      if (!freshWidget) return;
      setPageLayoutDraft((l) => ({
        ...l,
        tabs: l.tabs.map((t) => ({
          ...t,
          widgets: t.widgets.map((w) => (w.id === widgetId ? freshWidget : w)),
        })),
      }));
    },
  });

  const [editingWidget, setEditingWidget] = useState<{ tabId: string; widgetId: string } | null>(null);
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [addingWidgetTab, setAddingWidgetTab] = useState<string | null>(null);

  function updateLayout(updater: (l: PageLayout) => PageLayout): void {
    setPageLayoutDraft(updater);
  }

  if (!detail || !layout || !record) {
    return <div className="flex h-full items-center justify-center text-muted-foreground">Loading…</div>;
  }

  const object = detail.object;
  const labelField = detail.fields.find((f) => f.id === object.labelIdentifierFieldMetadataId);
  const recordName = resolveRecordLabel(record, labelField, detail.fields, object.labelSingular);
  const ObjectIcon = getIcon(object.icon);

  const allTabs = layout.tabs;
  const homeTab = allTabs.find((t) => t.widgets.some((w) => w.type === 'FIELDS')) ?? allTabs[0];
  const allActivityTabs = allTabs.filter((t) => t.id !== homeTab?.id);
  const activityTabs = isEditingLayout ? allActivityTabs : allActivityTabs.filter((t) => t.isVisible);

  const usedSingletonTypes = new Set(
    allTabs.flatMap((t) => t.widgets).map((w) => w.type).filter((t) => SINGLETON_WIDGET_TYPES.includes(t)),
  );
  const availableWidgetTypes: PageLayoutWidgetType[] = [
    ...SINGLETON_WIDGET_TYPES.filter((t) => !usedSingletonTypes.has(t)),
    'FIELD',
  ];

  const editingTab = editingTabId ? allTabs.find((t) => t.id === editingTabId) : undefined;
  const editingWidgetTab = editingWidget ? allTabs.find((t) => t.id === editingWidget.tabId) : undefined;
  const editingWidgetObj = editingWidgetTab?.widgets.find((w) => w.id === editingWidget?.widgetId);

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 shrink-0 items-center justify-between gap-3 border-b px-4">
        <div className="flex min-w-0 items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/objects/${objectNamePlural}`)}>
            <ArrowLeft className="size-4" />
          </Button>
          <ObjectIcon className="size-4 shrink-0 text-muted-foreground" />
          <RecordChip name={recordName} />
        </div>
        <div className="flex items-center gap-2">
          {isDirty && !isEditingLayout && (
            <>
              <Button variant="ghost" size="sm" onClick={() => setValues(record)}>
                Discard
              </Button>
              <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                Save
              </Button>
            </>
          )}
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="m-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex min-h-0 flex-1">
        {/* Left column — always-visible Fields/Field widgets + relation widgets */}
        <div className="w-95 shrink-0 overflow-y-auto border-r p-4">
          {isEditingLayout && homeTab && (
            <button
              type="button"
              onClick={() => setEditingTabId(homeTab.id)}
              className="mb-2 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              {homeTab.title} settings
            </button>
          )}
          <div className="space-y-4">
            {homeTab?.widgets
              .filter((w) => isEditingLayout || w.isVisible)
              .map((widget) => (
                <EditableWidget
                  key={widget.id}
                  isEditing={isEditingLayout}
                  onClick={() => setEditingWidget({ tabId: homeTab.id, widgetId: widget.id })}
                >
                  {widget.type === 'FIELDS' ? (
                    <FieldsWidget widget={widget} fields={detail.fields} record={record} values={values} onChange={setValues} />
                  ) : widget.type === 'FIELD' ? (
                    <FieldWidget widget={widget} fields={detail.fields} recordId={recordId!} values={values} onChange={setValues} />
                  ) : (
                    <ActivityWidget widget={widget} objectNameSingular={object.nameSingular} recordId={recordId!} />
                  )}
                </EditableWidget>
              ))}
            {isEditingLayout && homeTab && (
              <Button variant="outline" size="sm" className="w-full" onClick={() => setAddingWidgetTab(homeTab.id)}>
                <Plus className="size-3.5" /> Add widget
              </Button>
            )}
          </div>
        </div>

        {/* Right column — activity/custom tab strip */}
        {(activityTabs.length > 0 || isEditingLayout) && (
          <Tabs defaultValue={activityTabs[0]?.id} className="flex min-h-0 flex-1 flex-col">
            <TabsList className="mx-4 mt-3 self-start">
              {activityTabs.map((tab) => (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className={cn(!tab.isVisible && 'opacity-50')}
                  onClick={(e) => {
                    if (isEditingLayout) {
                      e.preventDefault();
                      setEditingTabId(tab.id);
                    }
                  }}
                >
                  {tab.title}
                </TabsTrigger>
              ))}
              {isEditingLayout && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-1 h-7"
                  onClick={() => updateLayout((l) => draft.addTab(l, 'New Tab'))}
                >
                  <Plus className="size-3.5" /> New Tab
                </Button>
              )}
            </TabsList>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {activityTabs.map((tab) => (
                <TabsContent key={tab.id} value={tab.id} className="px-4 py-4">
                  <div className="space-y-4">
                    {tab.widgets
                      .filter((w) => isEditingLayout || w.isVisible)
                      .map((widget) => (
                        <EditableWidget key={widget.id} isEditing={isEditingLayout} onClick={() => setEditingWidget({ tabId: tab.id, widgetId: widget.id })}>
                          {widget.type === 'FIELD' ? (
                            <FieldWidget widget={widget} fields={detail.fields} recordId={recordId!} values={values} onChange={setValues} />
                          ) : (
                            <ActivityWidget widget={widget} objectNameSingular={object.nameSingular} recordId={recordId!} />
                          )}
                        </EditableWidget>
                      ))}
                    {isEditingLayout && tab.widgets.length === 0 && (
                      <Button variant="outline" size="sm" onClick={() => setAddingWidgetTab(tab.id)}>
                        <Plus className="size-3.5" /> Add widget
                      </Button>
                    )}
                  </div>
                </TabsContent>
              ))}
            </div>
          </Tabs>
        )}
      </div>

      {editingWidgetObj && editingWidgetTab && (
        <WidgetEditPanel
          tab={editingWidgetTab}
          widget={editingWidgetObj}
          allTabs={allTabs}
          objectFields={detail.fields}
          onClose={() => setEditingWidget(null)}
          onUpdateLayout={updateLayout}
          onResetWidget={() => resetWidgetMutation.mutate(editingWidgetObj.id)}
        />
      )}

      {editingTab && (
        <TabEditPanel
          tab={editingTab}
          isHome={editingTab.id === homeTab?.id}
          index={allTabs.findIndex((t) => t.id === editingTab.id)}
          count={allTabs.length}
          onClose={() => setEditingTabId(null)}
          onUpdateLayout={updateLayout}
          onDelete={() => {
            updateLayout((l) => draft.deleteTab(l, editingTab.id));
            setEditingTabId(null);
          }}
        />
      )}

      {addingWidgetTab && (
        <AddWidgetPanel
          availableTypes={availableWidgetTypes}
          objectFields={detail.fields}
          onClose={() => setAddingWidgetTab(null)}
          onAdd={(type, title, configuration) => {
            updateLayout((l) => draft.addWidget(l, addingWidgetTab, type, title, configuration));
            setAddingWidgetTab(null);
          }}
        />
      )}
    </div>
  );
}
