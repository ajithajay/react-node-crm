import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  type DataModelField,
  type PageLayout,
  type PageLayoutWidget,
  type PageLayoutWidgetType,
  dataModelApi,
  recordApi,
} from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { isReverseRelationField } from '../lib/field-inputs';
import { friendlyFieldKey } from '../lib/field-values';
import { formatRelativeDate } from '../lib/format-relative-date';
import * as draft from '../lib/page-layout-draft';
import { RecordAttachmentsWidget } from '../components/RecordAttachmentsWidget';
import { RecordDocumentField, RecordField, RecordNameHeader, Section } from '../components/RecordFieldRows';
import { RecordDuplicatesWidget } from '../components/RecordDuplicatesWidget';
import { RecordJunctionWidget } from '../components/RecordJunctionWidget';
import { RecordRelationWidget } from '../components/RecordRelationWidget';
import { RecordTargetsWidget } from '../components/RecordTargetsWidget';
import { RecordTimelineWidget } from '../components/RecordTimelineWidget';
import { WidgetEditPanel } from '../components/record-layout-editor/WidgetEditPanel';
import { TabEditPanel } from '../components/record-layout-editor/TabEditPanel';
import { AddWidgetPanel } from '../components/record-layout-editor/AddWidgetPanel';
import { getIcon } from '@/lib/icons';
import { useLayoutCustomization } from '@/features/layout-customization/LayoutCustomizationContext';

/** Activity widgets are singletons (one Timeline/Notes/Tasks/Files per layout); FIELDS and FIELD can
 * both be added any number of times — multiple "Fields group" widgets are allowed. */
const SINGLETON_WIDGET_TYPES: PageLayoutWidgetType[] = ['TIMELINE', 'NOTES', 'TASKS', 'FILES'];

/** Task/Note's own junction → the "Relations" widget resolving which Company/Person/Opportunity
 * they're about, replacing the raw junction reverse-relation
 * widget that page-layout.seed.ts now excludes. */
const TARGET_RELATIONS_CONFIG: Record<string, { junctionObjectNamePlural: string; forwardKey: string }> = {
  task: { junctionObjectNamePlural: 'task_targets', forwardKey: 'taskId' },
  note: { junctionObjectNamePlural: 'note_targets', forwardKey: 'noteId' },
};

/** A single FIELD widget — a collection relation (People/Opportunities), a forward relation, or a
 * scalar field, rendered per its display mode (Field / Card / Table). */
function FieldWidget({
  widget,
  objectNamePlural,
  fields,
  recordId,
  record,
}: {
  widget: PageLayoutWidget;
  objectNamePlural: string;
  fields: DataModelField[];
  recordId: string;
  record: Record<string, unknown>;
}) {
  const field = fields.find((f) => f.id === widget.configuration.fieldMetadataId);
  if (!field) return null;
  const mode = widget.configuration.displayMode ?? 'PLAIN';

  // A Task/Note's body on its dedicated "Note" tab — full-width document, no icon/label/popover.
  if (mode === 'DOCUMENT') {
    return (
      <RecordDocumentField
        field={field}
        objectNamePlural={objectNamePlural}
        recordId={recordId}
        value={record[friendlyFieldKey(field)]}
      />
    );
  }

  // A collection/reverse relation renders the linked-records widget (add/detach/link) in the mode.
  if (isReverseRelationField(field)) {
    return <RecordRelationWidget field={field} sourceRecordId={recordId} displayMode={mode} />;
  }

  const body = (
    <RecordField
      objectNamePlural={objectNamePlural}
      recordId={recordId}
      field={field}
      record={record}
      variant={mode === 'TABLE' ? 'row' : 'stacked'}
    />
  );

  if (mode === 'CARD') return <div className="rounded-lg border bg-card p-3">{body}</div>;
  return body;
}

/** The activity widgets (Timeline/Notes/Tasks/Files) render straight from the record's morph relations. */
function ActivityWidget({
  widget,
  objectNameSingular,
  recordId,
  fields,
}: {
  widget: PageLayoutWidget;
  objectNameSingular: string;
  recordId: string;
  fields: DataModelField[];
}) {
  switch (widget.type) {
    case 'TIMELINE':
      return <RecordTimelineWidget sourceObjectNameSingular={objectNameSingular} sourceRecordId={recordId} fields={fields} />;
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
 * The FIELDS widget: named field groups from the page layout. Each field is a self-saving inline
 * cell (or a forward-relation picker, or a read-only system row). When "Display more fields" is on,
 * fields hidden from the record page appear under a collapsed "More (n)" disclosure.
 */
function FieldsWidget({
  widget,
  objectNamePlural,
  fields,
  recordId,
  record,
  excludeFieldIds,
}: {
  widget: PageLayoutWidget;
  objectNamePlural: string;
  fields: DataModelField[];
  recordId: string;
  record: Record<string, unknown>;
  /** Fields rendered elsewhere (the header title, a dedicated document tab, …) — never shown here. */
  excludeFieldIds: ReadonlySet<string>;
}) {
  const fieldById = new Map(fields.map((f) => [f.id, f]));
  const showMore = widget.configuration.showMoreFieldsButton === true;

  function renderField(field: DataModelField): React.ReactNode {
    return (
      <RecordField
        key={field.id}
        objectNamePlural={objectNamePlural}
        recordId={recordId}
        field={field}
        record={record}
        variant="row"
      />
    );
  }

  const hidden: DataModelField[] = [];

  return (
    <div className="space-y-4">
      {widget.groups
        .filter((g) => g.isVisible)
        .map((group) => {
          const visible: DataModelField[] = [];
          for (const gf of group.fields) {
            const field = fieldById.get(gf.fieldMetadataId);
            if (!field || excludeFieldIds.has(field.id)) continue;
            if (gf.isVisible) visible.push(field);
            else hidden.push(field);
          }
          if (!visible.length) return null;
          return (
            <Section key={group.id} title={group.label}>
              {visible.map(renderField)}
            </Section>
          );
        })}
      {showMore && hidden.length > 0 && (
        <Section title={`More (${hidden.length})`} defaultOpen={false}>
          {hidden.map(renderField)}
        </Section>
      )}
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
 * Full-page record view: a static left column (Fields/Field widgets +
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

  const saveNameMutation = useMutation({
    mutationFn: (input: { key: string; value: unknown }) =>
      recordApi.update(objectNamePlural!, recordId!, { [input.key]: input.value }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['record', objectNamePlural, recordId] }),
  });

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
  const ObjectIcon = getIcon(object.icon);
  const excludeFieldIds = new Set(labelField ? [labelField.id] : []);

  const allTabs = layout.tabs;
  const homeTab = allTabs.find((t) => t.widgets.some((w) => w.type === 'FIELDS')) ?? allTabs[0];
  const allActivityTabs = allTabs.filter((t) => t.id !== homeTab?.id);
  const activityTabs = isEditingLayout ? allActivityTabs : allActivityTabs.filter((t) => t.isVisible);

  const usedSingletonTypes = new Set(
    allTabs.flatMap((t) => t.widgets).map((w) => w.type).filter((t) => SINGLETON_WIDGET_TYPES.includes(t)),
  );
  const availableWidgetTypes: PageLayoutWidgetType[] = [
    'FIELDS',
    'FIELD',
    ...SINGLETON_WIDGET_TYPES.filter((t) => !usedSingletonTypes.has(t)),
  ];

  const editingTab = editingTabId ? allTabs.find((t) => t.id === editingTabId) : undefined;
  const editingWidgetTab = editingWidget ? allTabs.find((t) => t.id === editingWidget.tabId) : undefined;
  const editingWidgetObj = editingWidgetTab?.widgets.find((w) => w.id === editingWidget?.widgetId);

  return (
    <div className="flex h-full flex-col">
      <div className="flex min-h-14 shrink-0 items-center gap-3 border-b px-4 py-2">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/objects/${objectNamePlural}`)}>
          <ArrowLeft className="size-4" />
        </Button>
        <div className="flex min-w-0 flex-col gap-0.5">
          <div className="flex min-w-0 items-center gap-2">
            <ObjectIcon className="size-4 shrink-0 text-muted-foreground" />
            {labelField ? (
              <RecordNameHeader
                field={labelField}
                value={record[friendlyFieldKey(labelField)]}
                onChange={(v) => saveNameMutation.mutate({ key: friendlyFieldKey(labelField), value: v })}
                size="lg"
              />
            ) : (
              <span className="text-xl font-semibold">{object.labelSingular}</span>
            )}
          </div>
          {!!record.createdAt && (
            <span className="pl-6 text-xs text-muted-foreground">
              Added {formatRelativeDate(record.createdAt as string)}
            </span>
          )}
        </div>
      </div>

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
                    <FieldsWidget
                      widget={widget}
                      objectNamePlural={objectNamePlural!}
                      fields={detail.fields}
                      recordId={recordId!}
                      record={record}
                      excludeFieldIds={excludeFieldIds}
                    />
                  ) : widget.type === 'FIELD' ? (
                    <FieldWidget widget={widget} objectNamePlural={objectNamePlural!} fields={detail.fields} recordId={recordId!} record={record} />
                  ) : (
                    <ActivityWidget widget={widget} objectNameSingular={object.nameSingular} recordId={recordId!} fields={detail.fields} />
                  )}
                </EditableWidget>
              ))}
            {TARGET_RELATIONS_CONFIG[object.nameSingular] && (
              <RecordTargetsWidget
                junctionObjectNamePlural={TARGET_RELATIONS_CONFIG[object.nameSingular]!.junctionObjectNamePlural}
                forwardKey={TARGET_RELATIONS_CONFIG[object.nameSingular]!.forwardKey}
                sourceRecordId={recordId!}
              />
            )}
            {!isEditingLayout && (
              <RecordDuplicatesWidget objectNamePlural={objectNamePlural!} recordId={recordId!} fields={detail.fields} />
            )}
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
                            <FieldWidget widget={widget} objectNamePlural={objectNamePlural!} fields={detail.fields} recordId={recordId!} record={record} />
                          ) : (
                            <ActivityWidget widget={widget} objectNameSingular={object.nameSingular} recordId={recordId!} fields={detail.fields} />
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
