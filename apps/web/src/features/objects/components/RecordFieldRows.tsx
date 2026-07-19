import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { type DataModelField, recordApi } from '@/lib/api-client';
import { FieldInput, isEditableField } from '../lib/field-inputs';
import { fieldIcon } from '../lib/field-icon';
import { formatFieldValue, friendlyFieldKey } from '../lib/field-values';
import { formatRelativeDate } from '../lib/format-relative-date';
import { RecordFieldCell } from './RecordFieldCell';
import { RelationPickerInput } from './RelationPickerInput';
import { RichTextEditor, type RichTextValue } from './RichTextEditor';

/** Shared by every field-rendering surface (record detail page, create/edit sheet, relation-card
 * expansion) so they render fields identically — see `RecordField` below. */
export const SYSTEM_FIELD_NAMES: ReadonlySet<string> = new Set([
  'created_at',
  'updated_at',
  'deleted_at',
  'created_by',
  'updated_by',
]);
export const READ_ONLY_TYPES: ReadonlySet<string> = new Set(['ACTOR']);

/** A collapsible bordered card used to group fields (Fields widget sections, sheet field groups). */
export function Section({
  title,
  defaultOpen = true,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-lg border bg-card">
      <button
        type="button"
        className="flex w-full items-center gap-1.5 rounded-t-lg px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:bg-muted/50"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <ChevronDown className={cn('size-3.5 shrink-0 text-muted-foreground/70 transition-transform', !open && '-rotate-90')} />
        {title}
      </button>
      {open && <div className="space-y-3 border-t px-3 py-3">{children}</div>}
    </div>
  );
}

/** Read-only display for a system/audit field (created_at, created_by, …). */
export function ReadOnlyFieldRow({ field, record }: { field: DataModelField; record: Record<string, unknown> }) {
  const Icon = fieldIcon(field);
  const value = record[friendlyFieldKey(field)];
  const display =
    field.type === 'ACTOR'
      ? String((value as Record<string, unknown> | null)?.name || '—')
      : value
        ? formatRelativeDate(value as string)
        : '—';
  return (
    <div className="flex items-center gap-1 text-sm">
      <span className="flex w-22.5 shrink-0 items-center gap-1 truncate text-xs font-medium text-muted-foreground">
        <Icon className="size-3.5 shrink-0" />
        <span className="truncate">{field.label}</span>
      </span>
      <span className="min-h-8 flex-1 truncate px-2 py-1">{display}</span>
    </div>
  );
}

/** A forward (MANY_TO_ONE) relation field — self-saving picker chip with detach + click-through.
 * Pass `onChange` to redirect the commit into local draft state instead of the API (create/edit sheet). */
export function ForwardRelationCell({
  objectNamePlural,
  recordId,
  field,
  record,
  variant = 'stacked',
  onChange,
}: {
  objectNamePlural: string;
  recordId: string;
  field: DataModelField;
  record: Record<string, unknown>;
  variant?: 'stacked' | 'row';
  onChange?: (id: string | null) => void;
}) {
  const queryClient = useQueryClient();
  const key = friendlyFieldKey(field);
  const Icon = fieldIcon(field);
  const save = useMutation({
    mutationFn: (id: string | null) => recordApi.update(objectNamePlural, recordId, { [key]: id }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['record', objectNamePlural, recordId] }),
  });
  const picker = (
    <RelationPickerInput
      field={field}
      value={(record[key] as string) ?? null}
      onChange={(id) => (onChange ? onChange(id) : save.mutate(id))}
      linkRecords
    />
  );
  if (variant === 'row') {
    return (
      <div className="flex items-center gap-1">
        <span className="flex w-22.5 shrink-0 items-center gap-1 truncate text-xs font-medium text-muted-foreground">
          <Icon className="size-3.5 shrink-0" />
          <span className="truncate">{field.label}</span>
        </span>
        <div className="min-w-0 flex-1">{picker}</div>
      </div>
    );
  }
  return (
    <div className="space-y-1">
      <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
        <Icon className="size-3.5 shrink-0" />
        {field.label}
      </span>
      {picker}
    </div>
  );
}

/**
 * Single dispatcher used by every field-rendering surface: the record detail page's Fields widget,
 * the create/edit sheet, and a relation-card's expanded row all call this so they render identically.
 */
export function RecordField({
  field,
  objectNamePlural,
  recordId,
  record,
  variant = 'row',
  onChange,
}: {
  field: DataModelField;
  objectNamePlural: string;
  recordId: string;
  record: Record<string, unknown>;
  variant?: 'stacked' | 'row';
  /** Redirects the commit into local draft state instead of the API (create/edit sheet usage). */
  onChange?: (value: unknown) => void;
}) {
  const isSystem = READ_ONLY_TYPES.has(field.type) || SYSTEM_FIELD_NAMES.has(field.name);
  if (isSystem) return <ReadOnlyFieldRow field={field} record={record} />;
  if (field.type === 'RELATION' && field.settings?.relationType === 'MANY_TO_ONE') {
    return (
      <ForwardRelationCell
        objectNamePlural={objectNamePlural}
        recordId={recordId}
        field={field}
        record={record}
        variant={variant}
        onChange={onChange as ((id: string | null) => void) | undefined}
      />
    );
  }
  if (!isEditableField(field)) return null; // reverse relations etc. are their own widgets
  return (
    <RecordFieldCell
      objectNamePlural={objectNamePlural}
      recordId={recordId}
      field={field}
      value={record[friendlyFieldKey(field)]}
      variant={variant}
      onChange={onChange}
    />
  );
}

/**
 * The record's label-identifier field, rendered as an editable title — the name isn't
 * a normal Fields-section row; it lives in the header, click-to-edit, same for create and edit.
 * Pass `onChange` to redirect the commit into local draft state (create/edit sheet) instead of an
 * immediate self-save (full page).
 */
export function RecordNameHeader({
  field,
  value,
  onChange,
  size = 'md',
}: {
  field: DataModelField;
  value: unknown;
  onChange: (value: unknown) => void;
  size?: 'md' | 'lg';
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!editing) return;
    const input = containerRef.current?.querySelector('input, textarea') as HTMLInputElement | null;
    input?.focus();
    input?.select();
  }, [editing]);

  function startEdit(): void {
    setDraft(value);
    setEditing(true);
  }
  function commit(): void {
    setEditing(false);
    if (JSON.stringify(draft ?? null) !== JSON.stringify(value ?? null)) onChange(draft ?? null);
  }
  function cancel(): void {
    setEditing(false);
    setDraft(value);
  }

  if (!editing) {
    const display = formatFieldValue(field, { [friendlyFieldKey(field)]: value });
    return (
      <button
        type="button"
        onClick={startEdit}
        className={cn(
          'max-w-full truncate rounded px-1 text-left hover:bg-muted/60',
          size === 'lg' ? 'text-xl font-semibold' : 'text-sm font-medium',
        )}
      >
        {display === '—' ? 'Untitled' : display}
      </button>
    );
  }

  return (
    <div
      ref={containerRef}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) commit();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && field.type !== 'FULL_NAME') {
          e.preventDefault();
          commit();
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          cancel();
        }
      }}
      className={size === 'lg' ? 'text-xl' : 'text-sm'}
    >
      <FieldInput field={field} value={draft} onChange={setDraft} />
    </div>
  );
}

/**
 * A Task/Note's rich-text body rendered as a full-width, always-editable document — no icon, no
 * label, no popover (the "Note" tab's own field card, not a compact inline cell).
 * Pass `onChange` to redirect the commit into local draft state (create sheet) instead of self-saving.
 */
export function RecordDocumentField({
  field,
  objectNamePlural,
  recordId,
  value,
  onChange,
}: {
  field: DataModelField;
  objectNamePlural: string;
  recordId: string;
  value: unknown;
  onChange?: (value: RichTextValue) => void;
}) {
  const queryClient = useQueryClient();
  const key = friendlyFieldKey(field);
  const save = useMutation({
    mutationFn: (v: RichTextValue) => recordApi.update(objectNamePlural, recordId, { [key]: v }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['record', objectNamePlural, recordId] }),
  });
  return (
    <RichTextEditor
      value={value as RichTextValue | null | undefined}
      onChange={(v) => (onChange ? onChange(v) : save.mutate(v))}
    />
  );
}
