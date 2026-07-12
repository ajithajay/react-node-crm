import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, Maximize2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ApiError, type DataModelField, dataModelApi } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { FieldInput, isEditableField } from '../lib/field-inputs';
import { friendlyFieldKey } from '../lib/field-values';
import { RecordAttachmentsWidget } from './RecordAttachmentsWidget';
import { RecordChip } from './RecordChip';
import { RecordJunctionWidget } from './RecordJunctionWidget';
import { RecordRelationWidget } from './RecordRelationWidget';
import { RecordTimelineWidget } from './RecordTimelineWidget';

/**
 * Record detail (BRD §4: "tabbed layout of widgets — Fields, Timeline, Tasks, Notes, Files"),
 * presented as a right-side sheet rather than a centered modal, matching Twenty's "open in side
 * panel" record view. Used for both create (Overview tab only — the other tabs need a saved
 * record id) and edit (all tabs).
 *
 * Timeline/Notes/Tasks/Files are only meaningful for objects that are morph-relation targets
 * (Company/Person/Opportunity) — detected generically via the presence of the matching
 * `isMorphReverse` field on `fields`, rather than hardcoding object names.
 */
const DETAIL_TAB_DEFS = [
  { key: 'timeline', label: 'Timeline', reverseFieldName: 'timeline_activities' },
  { key: 'notes', label: 'Notes', reverseFieldName: 'note_targets' },
  { key: 'tasks', label: 'Tasks', reverseFieldName: 'task_targets' },
  { key: 'files', label: 'Files', reverseFieldName: 'attachments' },
] as const;

/** The morph junction/activity objects themselves — they back the tabs, so they don't get the tabs. */
const ACTIVITY_PLUMBING_OBJECTS: ReadonlySet<string> = new Set([
  'note_target',
  'task_target',
  'timeline_activity',
  'attachment',
  'workspace_member',
]);

/** created_at/updated_at/deleted_at/created_by/updated_by — displayed read-only, never in the editable form. */
const SYSTEM_FIELD_NAMES: ReadonlySet<string> = new Set([
  'created_at',
  'updated_at',
  'deleted_at',
  'created_by',
  'updated_by',
]);

function FieldSection({ title, defaultOpen = true, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b pb-3">
      <button
        type="button"
        className="mb-2 flex w-full items-center justify-between text-xs font-medium text-muted-foreground"
        onClick={() => setOpen((o) => !o)}
      >
        {title}
        <ChevronDown className={cn('size-3.5 transition-transform', !open && '-rotate-90')} />
      </button>
      {open && <div className="space-y-4">{children}</div>}
    </div>
  );
}

function FieldRow({
  field,
  value,
  onChange,
}: {
  field: DataModelField;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  return (
    <div>
      <Label>{field.label}</Label>
      <div className="mt-1">
        <FieldInput field={field} value={value} onChange={onChange} />
      </div>
    </div>
  );
}

function SystemFieldRow({ field, record }: { field: DataModelField; record: Record<string, unknown> }) {
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

function OverviewTab({
  fields,
  objectMetadataId,
  record,
  sourceRecordId,
  values,
  onChange,
}: {
  fields: DataModelField[];
  objectMetadataId: string | undefined;
  record: Record<string, unknown> | null;
  sourceRecordId: string | undefined;
  values: Record<string, unknown>;
  onChange: React.Dispatch<React.SetStateAction<Record<string, unknown>>>;
}) {
  const editableFields = fields.filter((f) => isEditableField(f) && f.isVisibleInRecordPage);
  const systemFields = fields.filter((f) => SYSTEM_FIELD_NAMES.has(f.name));
  const relationFields = fields.filter(
    (f) => f.type === 'RELATION' && f.settings?.relationType === 'ONE_TO_MANY' && !f.settings?.isMorphReverse,
  );

  // Named record-page sections (Twenty parity — e.g. Company's General/Business/Contact). Falls back
  // to a single "Fields" section when the object has none configured (gap D1/D2).
  const { data: sections } = useQuery({
    queryKey: ['object-sections', objectMetadataId],
    queryFn: () => dataModelApi.getSections(objectMetadataId!),
    enabled: !!objectMetadataId,
  });

  const editableById = new Map(editableFields.map((f) => [f.id, f]));
  let groups: { label: string; fields: DataModelField[] }[];
  if (sections && sections.length > 0) {
    const used = new Set<string>();
    groups = sections
      .map((s) => {
        const secFields = s.fieldMetadataIds
          .map((id) => editableById.get(id))
          .filter((f): f is DataModelField => !!f);
        secFields.forEach((f) => used.add(f.id));
        return { label: s.label, fields: secFields };
      })
      .filter((g) => g.fields.length > 0);
    const leftovers = editableFields.filter((f) => !used.has(f.id));
    if (leftovers.length) groups.push({ label: 'Other', fields: leftovers });
  } else {
    groups = [{ label: 'Fields', fields: editableFields }];
  }

  return (
    <div className="space-y-4 py-4">
      {groups.map((group) => (
        <FieldSection key={group.label} title={group.label}>
          {group.fields.map((field) => {
            const key = friendlyFieldKey(field);
            return (
              <FieldRow
                key={field.id}
                field={field}
                value={values[key]}
                onChange={(v) => onChange((prev) => ({ ...prev, [key]: v }))}
              />
            );
          })}
        </FieldSection>
      ))}

      {record && systemFields.length > 0 && (
        <FieldSection title="System" defaultOpen={false}>
          {systemFields.map((field) => (
            <SystemFieldRow key={field.id} field={field} record={record} />
          ))}
        </FieldSection>
      )}

      {sourceRecordId &&
        relationFields.map((field) => (
          <RecordRelationWidget key={field.id} field={field} sourceRecordId={sourceRecordId} />
        ))}
    </div>
  );
}

export function RecordSheet({
  open,
  onOpenChange,
  mode,
  objectLabel,
  objectNameSingular,
  objectNamePlural,
  objectMetadataId,
  fields,
  labelIdentifierField,
  initialValues,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  objectLabel: string;
  objectNameSingular: string;
  objectNamePlural?: string;
  objectMetadataId?: string;
  fields: DataModelField[];
  labelIdentifierField?: DataModelField;
  initialValues?: Record<string, unknown>;
  onSubmit: (body: Record<string, unknown>) => Promise<unknown>;
}) {
  const navigate = useNavigate();
  const [values, setValues] = useState<Record<string, unknown>>(initialValues ?? {});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const recordName = labelIdentifierField
    ? String(values[friendlyFieldKey(labelIdentifierField)] ?? '').trim()
    : '';
  const sourceRecordId = initialValues?.id as string | undefined;

  // Every real object gets Timeline/Notes/Tasks/Files (Twenty parity — its generic record layout
  // hardcodes these tabs). The junction/activity widgets query the *global* note_targets/task_targets/
  // attachments/timeline_activities objects by targetType/targetId, so they work for any object
  // (incl. custom) without that object carrying a reverse field. Only the activity/junction plumbing
  // objects themselves are excluded (they're never opened as user-facing records).
  const detailTabs = ACTIVITY_PLUMBING_OBJECTS.has(objectNameSingular) ? [] : DETAIL_TAB_DEFS;

  async function handleSubmit(): Promise<void> {
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(values);
      onOpenChange(false);
      setValues({});
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col sm:max-w-xl">
        <SheetHeader className="flex-row items-center justify-between border-b pr-10">
          <SheetTitle>
            {mode === 'create' ? (
              `New ${objectLabel}`
            ) : recordName ? (
              <RecordChip name={recordName} />
            ) : (
              `Edit ${objectLabel}`
            )}
          </SheetTitle>
          {mode === 'edit' && sourceRecordId && objectNamePlural && (
            <Button
              variant="ghost"
              size="icon"
              title="Open full page"
              onClick={() => {
                onOpenChange(false);
                navigate(`/objects/${objectNamePlural}/${sourceRecordId}`);
              }}
            >
              <Maximize2 className="size-4" />
            </Button>
          )}
        </SheetHeader>

        {mode === 'edit' && sourceRecordId ? (
          <Tabs defaultValue="overview" className="flex min-h-0 flex-1 flex-col">
            <TabsList className="mx-4">
              <TabsTrigger value="overview">Home</TabsTrigger>
              {detailTabs.map((t) => (
                <TabsTrigger key={t.key} value={t.key}>
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>
            <div className="flex-1 overflow-y-auto px-4 pb-4">
              <TabsContent value="overview">
                <OverviewTab
                  fields={fields}
                  objectMetadataId={objectMetadataId}
                  record={initialValues ?? null}
                  sourceRecordId={sourceRecordId}
                  values={values}
                  onChange={setValues}
                />
              </TabsContent>
              {detailTabs.map((t) => (
                <TabsContent key={t.key} value={t.key}>
                  {t.key === 'timeline' && (
                    <RecordTimelineWidget sourceObjectNameSingular={objectNameSingular} sourceRecordId={sourceRecordId} />
                  )}
                  {t.key === 'notes' && (
                    <RecordJunctionWidget
                      title="Notes"
                      junctionObjectNamePlural="note_targets"
                      itemObjectNamePlural="notes"
                      itemForwardKey="noteId"
                      itemLabelKey="title"
                      sourceObjectNameSingular={objectNameSingular}
                      sourceRecordId={sourceRecordId}
                    />
                  )}
                  {t.key === 'tasks' && (
                    <RecordJunctionWidget
                      title="Tasks"
                      junctionObjectNamePlural="task_targets"
                      itemObjectNamePlural="tasks"
                      itemForwardKey="taskId"
                      itemLabelKey="title"
                      sourceObjectNameSingular={objectNameSingular}
                      sourceRecordId={sourceRecordId}
                    />
                  )}
                  {t.key === 'files' && (
                    <RecordAttachmentsWidget sourceObjectNameSingular={objectNameSingular} sourceRecordId={sourceRecordId} />
                  )}
                </TabsContent>
              ))}
            </div>
          </Tabs>
        ) : (
          <div className="flex-1 overflow-y-auto px-4">
            <OverviewTab
              fields={fields}
              objectMetadataId={objectMetadataId}
              record={null}
              sourceRecordId={undefined}
              values={values}
              onChange={setValues}
            />
          </div>
        )}

        {error && (
          <Alert variant="destructive" className="mx-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <SheetFooter className="border-t">
          <Button onClick={() => void handleSubmit()} disabled={submitting}>
            {mode === 'create' ? 'Create' : 'Save'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
