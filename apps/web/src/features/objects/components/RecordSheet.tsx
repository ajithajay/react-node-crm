import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ApiError, type DataModelField } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { FieldInput, isEditableField } from '../lib/field-inputs';
import { friendlyFieldKey } from '../lib/field-values';
import { RecordChip } from './RecordChip';
import { RecordRelationWidget } from './RecordRelationWidget';

/**
 * Record detail (BRD §4: "tabbed layout of widgets — Fields, Timeline, Tasks, Notes, Files"),
 * presented as a right-side sheet rather than a centered modal, matching Twenty's "open in side
 * panel" record view. Used for both create (Overview tab only — the other tabs need a saved
 * record id) and edit (all tabs).
 */
const DETAIL_TABS = [
  { key: 'timeline', label: 'Timeline' },
  { key: 'notes', label: 'Notes' },
  { key: 'tasks', label: 'Tasks' },
  { key: 'files', label: 'Files' },
] as const;

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
  record,
  sourceRecordId,
  values,
  onChange,
}: {
  fields: DataModelField[];
  record: Record<string, unknown> | null;
  sourceRecordId: string | undefined;
  values: Record<string, unknown>;
  onChange: React.Dispatch<React.SetStateAction<Record<string, unknown>>>;
}) {
  const editableFields = fields.filter(isEditableField);
  const systemFields = fields.filter((f) => SYSTEM_FIELD_NAMES.has(f.name));
  const relationFields = fields.filter(
    (f) => f.type === 'RELATION' && f.settings?.relationType === 'ONE_TO_MANY' && !f.settings?.isMorphReverse,
  );

  return (
    <div className="space-y-4 py-4">
      <FieldSection title="Fields">
        {editableFields.map((field) => {
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
  fields,
  labelIdentifierField,
  initialValues,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  objectLabel: string;
  fields: DataModelField[];
  labelIdentifierField?: DataModelField;
  initialValues?: Record<string, unknown>;
  onSubmit: (body: Record<string, unknown>) => Promise<unknown>;
}) {
  const [values, setValues] = useState<Record<string, unknown>>(initialValues ?? {});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const recordName = labelIdentifierField
    ? String(values[friendlyFieldKey(labelIdentifierField)] ?? '').trim()
    : '';
  const sourceRecordId = initialValues?.id as string | undefined;

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
        <SheetHeader className="border-b">
          <SheetTitle>
            {mode === 'create' ? (
              `New ${objectLabel}`
            ) : recordName ? (
              <RecordChip name={recordName} />
            ) : (
              `Edit ${objectLabel}`
            )}
          </SheetTitle>
        </SheetHeader>

        {mode === 'edit' ? (
          <Tabs defaultValue="overview" className="flex min-h-0 flex-1 flex-col">
            <TabsList className="mx-4">
              <TabsTrigger value="overview">Home</TabsTrigger>
              {DETAIL_TABS.map((t) => (
                <TabsTrigger key={t.key} value={t.key}>
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>
            <div className="flex-1 overflow-y-auto px-4 pb-4">
              <TabsContent value="overview">
                <OverviewTab
                  fields={fields}
                  record={initialValues ?? null}
                  sourceRecordId={sourceRecordId}
                  values={values}
                  onChange={setValues}
                />
              </TabsContent>
              {DETAIL_TABS.map((t) => (
                <TabsContent key={t.key} value={t.key}>
                  <p className="pt-6 text-sm text-muted-foreground">
                    {t.label} isn&apos;t available yet — it needs polymorphic-relation queries that
                    aren&apos;t built yet (see task-list.md's Phase 6 record-detail-page follow-up).
                  </p>
                </TabsContent>
              ))}
            </div>
          </Tabs>
        ) : (
          <div className="flex-1 overflow-y-auto px-4">
            <OverviewTab
              fields={fields}
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
