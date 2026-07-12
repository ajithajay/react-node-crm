import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ChevronDown, Eye, EyeOff, MoreHorizontal, Plus, Trash, X } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ApiError,
  type DataModelField,
  type PageLayout,
  type PageLayoutTab,
  type PageLayoutWidget,
  type PageLayoutWidgetType,
  dataModelApi,
  recordApi,
} from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { FieldInput, isEditableField } from '../lib/field-inputs';
import { friendlyFieldKey, resolveRecordLabel } from '../lib/field-values';
import { RecordAttachmentsWidget } from '../components/RecordAttachmentsWidget';
import { RecordChip } from '../components/RecordChip';
import { RecordJunctionWidget } from '../components/RecordJunctionWidget';
import { RecordRelationWidget } from '../components/RecordRelationWidget';
import { RecordTimelineWidget } from '../components/RecordTimelineWidget';
import { getIcon } from '@/lib/icons';
import { makeTempId, useLayoutCustomization } from '@/features/layout-customization/LayoutCustomizationContext';

const SYSTEM_FIELD_NAMES: ReadonlySet<string> = new Set([
  'created_at',
  'updated_at',
  'deleted_at',
  'created_by',
  'updated_by',
]);

const ACTIVITY_WIDGET_TITLES: Record<Exclude<PageLayoutWidgetType, 'FIELDS'>, string> = {
  TIMELINE: 'Timeline',
  NOTES: 'Notes',
  TASKS: 'Tasks',
  FILES: 'Files',
};

function Section({
  title,
  defaultOpen = true,
  headerExtra,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  headerExtra?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center justify-between px-4 py-2.5">
        <button
          type="button"
          className="flex flex-1 items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
          onClick={() => setOpen((o) => !o)}
        >
          {title}
          <ChevronDown className={cn('size-4 transition-transform', !open && '-rotate-90')} />
        </button>
        {headerExtra}
      </div>
      {open && <div className="space-y-4 border-t px-4 py-4">{children}</div>}
    </div>
  );
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

/** The Home-tab FIELDS widget: field groups (from the page layout) + reverse-relation widgets + system.
 * In edit mode, groups/fields get rename/hide/delete/add/reorder controls. */
function FieldsWidget({
  widget,
  fields,
  record,
  recordId,
  values,
  onChange,
  isEditing,
  onWidgetChange,
}: {
  widget: PageLayoutWidget;
  fields: DataModelField[];
  record: Record<string, unknown>;
  recordId: string;
  values: Record<string, unknown>;
  onChange: React.Dispatch<React.SetStateAction<Record<string, unknown>>>;
  isEditing: boolean;
  onWidgetChange?: (updater: (w: PageLayoutWidget) => PageLayoutWidget) => void;
}) {
  const fieldById = new Map(fields.map((f) => [f.id, f]));
  const editableIds = new Set(fields.filter(isEditableField).map((f) => f.id));

  const relationFields = fields.filter(
    (f) => f.type === 'RELATION' && f.settings?.relationType === 'ONE_TO_MANY' && !f.settings?.isMorphReverse,
  );
  const systemFields = fields.filter((f) => SYSTEM_FIELD_NAMES.has(f.name));

  const assignedFieldIds = new Set(widget.groups.flatMap((g) => g.fields.map((f) => f.fieldMetadataId)));
  const unassignedEditableFields = fields.filter((f) => editableIds.has(f.id) && !assignedFieldIds.has(f.id));

  function updateGroups(updater: (groups: PageLayoutWidget['groups']) => PageLayoutWidget['groups']): void {
    onWidgetChange?.((w) => ({ ...w, groups: updater(w.groups) }));
  }

  function moveGroup(index: number, dir: -1 | 1): void {
    updateGroups((groups) => {
      const next = [...groups];
      const j = index + dir;
      if (j < 0 || j >= next.length) return groups;
      [next[index], next[j]] = [next[j]!, next[index]!];
      return next;
    });
  }

  const groups = isEditing ? widget.groups : widget.groups.filter((g) => g.isVisible);

  return (
    <div className="space-y-4">
      {groups.map((group, index) => {
        const groupFieldEntries = group.fields
          .map((gf) => ({ gf, field: fieldById.get(gf.fieldMetadataId) }))
          .filter((e): e is { gf: (typeof group.fields)[number]; field: DataModelField } => !!e.field)
          .filter((e) => isEditing || (e.gf.isVisible && editableIds.has(e.field.id)));
        if (!groupFieldEntries.length && !isEditing) return null;

        return (
          <Section
            key={group.id}
            title={isEditing ? '' : group.label}
            headerExtra={
              isEditing ? (
                <div className="flex flex-1 items-center gap-1.5">
                  <Input
                    value={group.label}
                    onChange={(e) =>
                      updateGroups((groups) => groups.map((g, i) => (i === index ? { ...g, label: e.target.value } : g)))
                    }
                    className="h-7 max-w-48 text-xs"
                  />
                  <div className="ml-auto flex items-center gap-0.5">
                    <Button variant="ghost" size="icon" className="size-6" onClick={() => moveGroup(index, -1)} disabled={index === 0}>
                      <ChevronDown className="size-3.5 rotate-180" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-6"
                      onClick={() => moveGroup(index, 1)}
                      disabled={index === groups.length - 1}
                    >
                      <ChevronDown className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-6"
                      onClick={() =>
                        updateGroups((groups) => groups.map((g, i) => (i === index ? { ...g, isVisible: !g.isVisible } : g)))
                      }
                    >
                      {group.isVisible ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-6 text-destructive"
                      onClick={() => updateGroups((groups) => groups.filter((_, i) => i !== index))}
                    >
                      <Trash className="size-3.5" />
                    </Button>
                  </div>
                </div>
              ) : undefined
            }
          >
            {groupFieldEntries.map(({ gf, field }) => {
              const key = friendlyFieldKey(field);
              return isEditing ? (
                <div key={field.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={gf.isVisible}
                    onCheckedChange={(c) =>
                      updateGroups((groups) =>
                        groups.map((g, i) =>
                          i === index
                            ? {
                                ...g,
                                fields: g.fields.map((f) =>
                                  f.fieldMetadataId === field.id ? { ...f, isVisible: c === true } : f,
                                ),
                              }
                            : g,
                        ),
                      )
                    }
                  />
                  <span className="flex-1">{field.label}</span>
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() =>
                      updateGroups((groups) =>
                        groups.map((g, i) =>
                          i === index ? { ...g, fields: g.fields.filter((f) => f.fieldMetadataId !== field.id) } : g,
                        ),
                      )
                    }
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ) : (
                <div key={field.id}>
                  <Label>{field.label}</Label>
                  <div className="mt-1">
                    <FieldInput field={field} value={values[key]} onChange={(v) => onChange((p) => ({ ...p, [key]: v }))} />
                  </div>
                </div>
              );
            })}

            {isEditing && unassignedEditableFields.length > 0 && (
              <Select
                value=""
                onValueChange={(fid: string | null) => {
                  const field = fid ? fieldById.get(fid) : undefined;
                  if (!fid || !field) return;
                  updateGroups((groups) =>
                    groups.map((g, i) =>
                      i === index
                        ? {
                            ...g,
                            fields: [
                              ...g.fields,
                              { fieldMetadataId: fid, isVisible: true, label: field.label, icon: field.icon, fieldType: field.type },
                            ],
                          }
                        : g,
                    ),
                  );
                }}
              >
                <SelectTrigger className="h-7 w-full text-xs">
                  <SelectValue placeholder="+ Add field" />
                </SelectTrigger>
                <SelectContent>
                  {unassignedEditableFields.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Section>
        );
      })}

      {isEditing && (
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() =>
            updateGroups((groups) => [...groups, { id: makeTempId('group'), label: 'New group', isVisible: true, position: groups.length, fields: [] }])
          }
        >
          <Plus className="size-3.5" /> Add group
        </Button>
      )}

      {relationFields.map((field) => (
        <RecordRelationWidget key={field.id} field={field} sourceRecordId={recordId} />
      ))}

      {!isEditing && systemFields.length > 0 && (
        <Section title="System" defaultOpen={false}>
          {systemFields.map((field) => {
            const value = record[friendlyFieldKey(field)];
            const display =
              field.type === 'ACTOR'
                ? String((value as Record<string, unknown> | null)?.name || '—')
                : value
                  ? new Date(value as string).toLocaleString()
                  : '—';
            return (
              <div key={field.id} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{field.label}</span>
                <span>{display}</span>
              </div>
            );
          })}
        </Section>
      )}
    </div>
  );
}

/** Per-tab "..." menu shown only in edit mode: rename, hide/show, move left/right, delete. */
function TabEditMenu({
  tab,
  index,
  count,
  onUpdate,
  onMove,
  onDelete,
}: {
  tab: PageLayoutTab;
  index: number;
  count: number;
  onUpdate: (updater: (t: PageLayoutTab) => PageLayoutTab) => void;
  onMove: (dir: -1 | 1) => void;
  onDelete: () => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [title, setTitle] = useState(tab.title);

  if (renaming) {
    return (
      <div className="flex items-center gap-1">
        <Input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="h-6 w-24 text-xs"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              onUpdate((t) => ({ ...t, title }));
              setRenaming(false);
            }
          }}
        />
        <button
          type="button"
          onClick={() => {
            onUpdate((t) => ({ ...t, title }));
            setRenaming(false);
          }}
        >
          <Eye className="size-3.5" />
        </button>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<button type="button" className="ml-1 text-muted-foreground" />}>
        <MoreHorizontal className="size-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem onClick={() => setRenaming(true)}>Rename</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onUpdate((t) => ({ ...t, isVisible: !t.isVisible }))}>
          {tab.isVisible ? 'Hide tab' : 'Show tab'}
        </DropdownMenuItem>
        <DropdownMenuItem disabled={index === 0} onClick={() => onMove(-1)}>
          Move left
        </DropdownMenuItem>
        <DropdownMenuItem disabled={index === count - 1} onClick={() => onMove(1)}>
          Move right
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onClick={onDelete}>
          Delete tab
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Full-page record view (Twenty's record show page): a static left column (Fields widget +
 * relation widgets) and a right-side tab strip (Timeline/Notes/Tasks/Files). The layout customizer
 * (Settings → Layout / Data Model → Object → Layout) edits this page's tabs/widgets/field-groups in
 * place via `?customize=1`. Reached from a record's side sheet via "Open full page", or directly at
 * `/objects/:objectNamePlural/:recordId`.
 */
export function RecordDetailPage() {
  const { objectNamePlural, recordId } = useParams<{ objectNamePlural: string; recordId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { pageLayout, enterPageLayoutMode, setPageLayoutDraft } = useLayoutCustomization();

  const { data: objectSummary } = useQuery({
    queryKey: ['data-model-objects'],
    queryFn: () => dataModelApi.listObjects(),
  });
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

  if (!detail || !layout || !record) {
    return <div className="flex h-full items-center justify-center text-muted-foreground">Loading…</div>;
  }

  const object = detail.object;
  const labelField = detail.fields.find((f) => f.id === object.labelIdentifierFieldMetadataId);
  const recordName = resolveRecordLabel(record, labelField, detail.fields, object.labelSingular);
  const ObjectIcon = getIcon(object.icon);

  // Twenty's record page: the Home tab's FIELDS widget renders as a static left column (not a
  // switchable tab); the remaining tabs (Timeline/Notes/Tasks/Files) form the right-side tab strip.
  const allTabs = layout.tabs;
  const homeTab = allTabs.find((t) => t.widgets.some((w) => w.type === 'FIELDS')) ?? allTabs[0];
  const allActivityTabs = allTabs.filter((t) => t.id !== homeTab?.id);
  const activityTabs = isEditingLayout ? allActivityTabs : allActivityTabs.filter((t) => t.isVisible);

  const missingActivityTypes = (Object.keys(ACTIVITY_WIDGET_TITLES) as (keyof typeof ACTIVITY_WIDGET_TITLES)[]).filter(
    (type) => !allActivityTabs.some((t) => t.widgets.some((w) => w.type === type)),
  );

  function updateTabs(updater: (tabs: PageLayoutTab[]) => PageLayoutTab[]): void {
    setPageLayoutDraft((l) => ({ ...l, tabs: updater(l.tabs) }));
  }

  function updateHomeWidget(updater: (w: PageLayoutWidget) => PageLayoutWidget): void {
    if (!homeTab) return;
    updateTabs((tabs) => tabs.map((t) => (t.id === homeTab.id ? { ...t, widgets: t.widgets.map((w) => (w.type === 'FIELDS' ? updater(w) : w)) } : t)));
  }

  function addActivityTab(type: keyof typeof ACTIVITY_WIDGET_TITLES): void {
    const title = ACTIVITY_WIDGET_TITLES[type];
    updateTabs((tabs) => [
      ...tabs,
      {
        id: makeTempId('tab'),
        title,
        icon: null,
        position: tabs.length,
        isVisible: true,
        widgets: [{ id: makeTempId('widget'), type, title, position: 0, isVisible: true, groups: [] }],
      },
    ]);
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
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
              <Button variant="ghost" size="sm" onClick={() => { setValues(record); }}>
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
        {/* Left column — always-visible Fields widget + relation widgets */}
        <div className="w-95 shrink-0 overflow-y-auto border-r p-4">
          {homeTab?.widgets
            .filter((w) => isEditingLayout || w.isVisible)
            .map((widget) =>
              widget.type === 'FIELDS' ? (
                <FieldsWidget
                  key={widget.id}
                  widget={widget}
                  fields={detail.fields}
                  record={record}
                  recordId={recordId!}
                  values={values}
                  onChange={setValues}
                  isEditing={isEditingLayout}
                  onWidgetChange={updateHomeWidget}
                />
              ) : (
                <ActivityWidget key={widget.id} widget={widget} objectNameSingular={object.nameSingular} recordId={recordId!} />
              ),
            )}
        </div>

        {/* Right column — activity tab strip */}
        {(activityTabs.length > 0 || isEditingLayout) && (
          <Tabs defaultValue={activityTabs[0]?.id} className="flex min-h-0 flex-1 flex-col">
            <TabsList className="mx-4 mt-3 self-start">
              {activityTabs.map((tab, index) => (
                <div key={tab.id} className={cn('flex items-center', !tab.isVisible && 'opacity-50')}>
                  <TabsTrigger value={tab.id}>{tab.title}</TabsTrigger>
                  {isEditingLayout && (
                    <TabEditMenu
                      tab={tab}
                      index={index}
                      count={activityTabs.length}
                      onUpdate={(updater) => updateTabs((tabs) => tabs.map((t) => (t.id === tab.id ? updater(t) : t)))}
                      onMove={(dir) =>
                        updateTabs((tabs) => {
                          const next = [...tabs];
                          const i = next.findIndex((t) => t.id === tab.id);
                          const j = i + dir;
                          if (i < 0 || j < 0 || j >= next.length) return tabs;
                          [next[i], next[j]] = [next[j]!, next[i]!];
                          return next;
                        })
                      }
                      onDelete={() => updateTabs((tabs) => tabs.filter((t) => t.id !== tab.id))}
                    />
                  )}
                </div>
              ))}
              {isEditingLayout && missingActivityTypes.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="size-7" />}>
                    <Plus className="size-3.5" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    {missingActivityTypes.map((type) => (
                      <DropdownMenuItem key={type} onClick={() => addActivityTab(type)}>
                        {ACTIVITY_WIDGET_TITLES[type]}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </TabsList>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {activityTabs.map((tab) => (
                <TabsContent key={tab.id} value={tab.id} className="px-4 py-4">
                  <div className="space-y-4">
                    {tab.widgets
                      .filter((w) => isEditingLayout || w.isVisible)
                      .map((widget) => (
                        <ActivityWidget
                          key={widget.id}
                          widget={widget}
                          objectNameSingular={object.nameSingular}
                          recordId={recordId!}
                        />
                      ))}
                  </div>
                </TabsContent>
              ))}
            </div>
          </Tabs>
        )}
      </div>
    </div>
  );
}
