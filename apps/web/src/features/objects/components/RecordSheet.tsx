import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Maximize2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getIcon } from '@/lib/icons';
import { ApiError, type DataModelField, dataModelApi } from '@/lib/api-client';
import { isEditableField } from '../lib/field-inputs';
import { friendlyFieldKey } from '../lib/field-values';
import { formatRelativeDate } from '../lib/format-relative-date';
import { ReadOnlyFieldRow, RecordDocumentField, RecordField, RecordNameHeader, Section } from './RecordFieldRows';
import { RecordAttachmentsWidget } from './RecordAttachmentsWidget';
import { RecordJunctionWidget } from './RecordJunctionWidget';
import { RecordRelationWidget } from './RecordRelationWidget';
import { RecordTargetsWidget } from './RecordTargetsWidget';
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
  { key: 'note', label: 'Note', reverseFieldName: undefined },
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

/** Task/Note get "Note" (their own body as a document) + Timeline + Files, and skip the generic
 * Notes/Tasks relation tabs (a task doesn't have sub-notes/sub-tasks) — mirrors `activityWidgetTypes`
 * in the standard-objects seed (packages/database), which the full record page already honors via
 * its persisted page layout. */
const LIMITED_ACTIVITY_TAB_KEYS: ReadonlySet<string> = new Set(['note', 'timeline', 'files']);
const LIMITED_ACTIVITY_OBJECTS: ReadonlySet<string> = new Set(['task', 'note']);

/** Task's/Note's own junction → the "Relations" widget (which Company/Person/Opportunity it's
 * about), replacing the raw junction reverse-relation widget filtered out below. */
const TARGET_RELATIONS_CONFIG: Record<string, { junctionObjectNamePlural: string; forwardKey: string }> = {
  task: { junctionObjectNamePlural: 'task_targets', forwardKey: 'taskId' },
  note: { junctionObjectNamePlural: 'note_targets', forwardKey: 'noteId' },
};

/** created_at/updated_at/deleted_at/created_by/updated_by — displayed read-only, never in the editable form. */
const SYSTEM_FIELD_NAMES: ReadonlySet<string> = new Set([
  'created_at',
  'updated_at',
  'deleted_at',
  'created_by',
  'updated_by',
]);

function OverviewTab({
  fields,
  objectMetadataId,
  record,
  sourceRecordId,
  labelFieldId,
  documentFieldName,
  targetRelations,
  values,
  onChange,
}: {
  fields: DataModelField[];
  objectMetadataId: string | undefined;
  record: Record<string, unknown> | null;
  sourceRecordId: string | undefined;
  /** The label-identifier field — never shown here, it lives in the sheet header instead. */
  labelFieldId: string | undefined;
  /** Task/Note's rich-text body — shown as its own full-width document block, not a compact row. */
  documentFieldName: string | undefined;
  /** Task/Note's own "Relations" config — replaces the raw junction reverse-relation widget below. */
  targetRelations: { junctionObjectNamePlural: string; forwardKey: string } | undefined;
  values: Record<string, unknown>;
  onChange: React.Dispatch<React.SetStateAction<Record<string, unknown>>>;
}) {
  const documentField = fields.find((f) => f.name === documentFieldName);
  const editableFields = fields.filter(
    (f) => isEditableField(f) && f.isVisibleInRecordPage && f.id !== labelFieldId && f.id !== documentField?.id,
  );
  const systemFields = fields.filter((f) => SYSTEM_FIELD_NAMES.has(f.name));

  // Reverse relations pointing at a junction/activity-plumbing object (e.g. Task's own
  // `task_targets`) are internal wiring — `targetRelations` (Task/Note only) replaces them with the
  // resolved Company/Person/Opportunity chips instead; every other object keeps its normal collection widgets.
  const { data: objects } = useQuery({ queryKey: ['data-model-objects'], queryFn: dataModelApi.listObjects });
  const relationFields = fields.filter((f) => {
    if (f.type !== 'RELATION' || f.settings?.relationType !== 'ONE_TO_MANY' || f.settings?.isMorphReverse) return false;
    const targetId = f.settings?.relationTargetObjectMetadataId;
    const targetObject = objects?.find((o) => o.id === targetId);
    return !targetObject || !ACTIVITY_PLUMBING_OBJECTS.has(targetObject.nameSingular);
  });

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

  const draftRecord = { ...values, id: sourceRecordId };

  return (
    <div className="space-y-3 py-4">
      {groups.map((group) => (
        <Section key={group.label} title={group.label}>
          {group.fields.map((field) => {
            const key = friendlyFieldKey(field);
            return (
              <RecordField
                key={field.id}
                // Draft mode (onChange provided below) never invokes the API, so this is inert.
                objectNamePlural=""
                recordId={sourceRecordId ?? ''}
                field={field}
                record={draftRecord}
                variant="row"
                onChange={(v) => onChange((prev) => ({ ...prev, [key]: v }))}
              />
            );
          })}
        </Section>
      ))}

      {record && systemFields.length > 0 && (
        <Section title="System" defaultOpen={false}>
          {systemFields.map((field) => (
            <ReadOnlyFieldRow key={field.id} field={field} record={record} />
          ))}
        </Section>
      )}

      {documentField && !sourceRecordId && (
        <RecordDocumentField
          field={documentField}
          objectNamePlural=""
          recordId={sourceRecordId ?? ''}
          value={values[friendlyFieldKey(documentField)]}
          onChange={(v) => {
            const key = friendlyFieldKey(documentField);
            onChange((prev) => ({ ...prev, [key]: v }));
          }}
        />
      )}

      {sourceRecordId &&
        relationFields.map((field) => (
          <RecordRelationWidget key={field.id} field={field} sourceRecordId={sourceRecordId} />
        ))}

      {sourceRecordId && targetRelations && (
        <RecordTargetsWidget
          junctionObjectNamePlural={targetRelations.junctionObjectNamePlural}
          forwardKey={targetRelations.forwardKey}
          sourceRecordId={sourceRecordId}
        />
      )}
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
  objectIcon,
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
  objectIcon?: string;
  fields: DataModelField[];
  labelIdentifierField?: DataModelField;
  initialValues?: Record<string, unknown>;
  onSubmit: (body: Record<string, unknown>) => Promise<unknown>;
}) {
  const navigate = useNavigate();
  const [values, setValues] = useState<Record<string, unknown>>(initialValues ?? {});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const sourceRecordId = initialValues?.id as string | undefined;
  // Task/Note's rich-text body is excluded from the compact Fields list and shown as its own
  // full-width document block (create) / "Note" tab (edit) instead — see (C) in the plan.
  const documentFieldName = LIMITED_ACTIVITY_OBJECTS.has(objectNameSingular) ? 'body' : undefined;
  const documentField = fields.find((f) => f.name === documentFieldName);
  const targetRelations = TARGET_RELATIONS_CONFIG[objectNameSingular];

  // Every real object gets Timeline/Notes/Tasks/Files (Twenty parity — its generic record layout
  // hardcodes these tabs). The junction/activity widgets query the *global* note_targets/task_targets/
  // attachments/timeline_activities objects by targetType/targetId, so they work for any object
  // (incl. custom) without that object carrying a reverse field. Only the activity/junction plumbing
  // objects themselves are excluded (they're never opened as user-facing records).
  const detailTabs = ACTIVITY_PLUMBING_OBJECTS.has(objectNameSingular)
    ? []
    : LIMITED_ACTIVITY_OBJECTS.has(objectNameSingular)
      ? DETAIL_TAB_DEFS.filter((t) => LIMITED_ACTIVITY_TAB_KEYS.has(t.key))
      : DETAIL_TAB_DEFS.filter((t) => t.key !== 'note');

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

  const ObjectIcon = getIcon(objectIcon ?? 'Circle');
  const createdAt = initialValues?.createdAt as string | undefined;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col sm:max-w-xl">
        <SheetHeader className="flex-row items-center justify-between gap-3 border-b pr-10">
          <div className="flex min-w-0 flex-col gap-0.5">
            <div className="flex min-w-0 items-center gap-2">
              <ObjectIcon className="size-4 shrink-0 text-muted-foreground" />
              <SheetTitle className="sr-only">{mode === 'create' ? `New ${objectLabel}` : `Edit ${objectLabel}`}</SheetTitle>
              {labelIdentifierField ? (
                <RecordNameHeader
                  field={labelIdentifierField}
                  value={values[friendlyFieldKey(labelIdentifierField)]}
                  onChange={(v) => {
                    const key = friendlyFieldKey(labelIdentifierField);
                    setValues((prev) => ({ ...prev, [key]: v }));
                  }}
                />
              ) : (
                <span className="text-sm font-medium">{mode === 'create' ? `New ${objectLabel}` : `Edit ${objectLabel}`}</span>
              )}
            </div>
            {mode === 'edit' && !!createdAt && (
              <span className="pl-6 text-xs text-muted-foreground">Added {formatRelativeDate(createdAt)}</span>
            )}
          </div>
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
                  labelFieldId={labelIdentifierField?.id}
                  documentFieldName={documentFieldName}
                  targetRelations={targetRelations}
                  values={values}
                  onChange={setValues}
                />
              </TabsContent>
              {detailTabs.map((t) => (
                <TabsContent key={t.key} value={t.key}>
                  {t.key === 'note' && documentField && (
                    <RecordDocumentField
                      field={documentField}
                      objectNamePlural={objectNamePlural!}
                      recordId={sourceRecordId}
                      value={initialValues?.[friendlyFieldKey(documentField)]}
                    />
                  )}
                  {t.key === 'timeline' && (
                    <RecordTimelineWidget sourceObjectNameSingular={objectNameSingular} sourceRecordId={sourceRecordId} fields={fields} />
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
              labelFieldId={labelIdentifierField?.id}
              documentFieldName={documentFieldName}
              targetRelations={targetRelations}
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
