import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FieldMetadataType } from '@saasly/shared';
import { Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { type DataModelField, recordApi } from '@/lib/api-client';
import { FieldInput } from '../lib/field-inputs';
import { fieldIcon } from '../lib/field-icon';
import { ensureAbsoluteUrl, friendlyFieldKey, isFieldDraftValid, selectColor, selectLabel } from '../lib/field-values';
import { formatRelativeDate } from '../lib/format-relative-date';

const RELATIVE_DATE_FIELD_NAMES: ReadonlySet<string> = new Set(['created_at', 'updated_at']);
import { Tag } from './Tag';

/** Rich read-only rendering of a scalar/composite field value (clickable links, tags, etc.). */
function FieldValueDisplay({ field, value }: { field: DataModelField; value: unknown }) {
  if (value === null || value === undefined || value === '') {
    return <span className="text-muted-foreground">Empty</span>;
  }
  switch (field.type) {
    case FieldMetadataType.BOOLEAN:
      return value ? <Check className="size-4 text-emerald-600" /> : <X className="size-4 text-muted-foreground" />;
    case FieldMetadataType.SELECT:
      return <Tag label={selectLabel(field, value)} color={selectColor(field, value)} />;
    case FieldMetadataType.MULTI_SELECT:
      return (
        <span className="flex flex-wrap gap-1">
          {(value as string[]).map((v) => (
            <Tag key={v} label={selectLabel(field, v)} color={selectColor(field, v)} />
          ))}
        </span>
      );
    case FieldMetadataType.LINKS: {
      const url = (value as { primaryLinkUrl?: string }).primaryLinkUrl;
      if (!url) return <span className="text-muted-foreground">Empty</span>;
      const href = ensureAbsoluteUrl(url);
      let host = url;
      try {
        host = new URL(href).hostname;
      } catch {
        /* keep raw */
      }
      return (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="truncate text-primary underline-offset-2 hover:underline"
        >
          {host}
        </a>
      );
    }
    case FieldMetadataType.CURRENCY: {
      const v = value as { amountMicros?: number | string | null; currencyCode?: string | null };
      if (v.amountMicros == null) return <span className="text-muted-foreground">Empty</span>;
      return <span>{`${v.currencyCode ?? ''} ${(Number(v.amountMicros) / 1_000_000).toLocaleString()}`.trim()}</span>;
    }
    case FieldMetadataType.EMAILS: {
      const email = (value as { primaryEmail?: string }).primaryEmail;
      return email ? (
        <a href={`mailto:${email}`} onClick={(e) => e.stopPropagation()} className="text-primary hover:underline">
          {email}
        </a>
      ) : (
        <span className="text-muted-foreground">Empty</span>
      );
    }
    case FieldMetadataType.PHONES:
      return <span>{(value as { primaryPhoneNumber?: string }).primaryPhoneNumber || '—'}</span>;
    case FieldMetadataType.FULL_NAME: {
      const v = value as { firstName?: string; lastName?: string };
      return <span>{`${v.firstName ?? ''} ${v.lastName ?? ''}`.trim() || '—'}</span>;
    }
    case FieldMetadataType.ADDRESS: {
      const v = value as Record<string, string | null>;
      return <span>{[v.street1, v.city, v.state, v.country].filter(Boolean).join(', ') || '—'}</span>;
    }
    case FieldMetadataType.RICH_TEXT:
      return <span className="truncate">{(value as { markdown?: string }).markdown?.slice(0, 120) || '—'}</span>;
    case FieldMetadataType.DATE:
      return (
        <span>
          {RELATIVE_DATE_FIELD_NAMES.has(field.name)
            ? formatRelativeDate(value as string)
            : new Date(value as string).toLocaleDateString()}
        </span>
      );
    case FieldMetadataType.DATE_TIME:
      return (
        <span>
          {RELATIVE_DATE_FIELD_NAMES.has(field.name)
            ? formatRelativeDate(value as string)
            : new Date(value as string).toLocaleString()}
        </span>
      );
    default:
      return <span className="truncate">{String(value)}</span>;
  }
}

/** Field types edited inline (Enter commits); composite/picker types commit on close only. */
const ENTER_COMMITS: ReadonlySet<string> = new Set([
  FieldMetadataType.TEXT,
  FieldMetadataType.NUMBER,
  FieldMetadataType.RATING,
  FieldMetadataType.UUID,
]);

function normalizeDraft(field: DataModelField, draft: unknown): unknown {
  if (field.type === FieldMetadataType.LINKS) {
    const v = (draft ?? {}) as Record<string, unknown>;
    const url = (v.primaryLinkUrl as string | null) ?? '';
    return { ...v, primaryLinkUrl: url.trim() ? ensureAbsoluteUrl(url) : null };
  }
  return draft;
}

/**
 * A self-saving inline field cell (Twenty parity): click the value → editor opens in a popover →
 * closing commits a single `updateOne` for just this field (skipped if unchanged), invalid input
 * (e.g. a bad URL) blocks the commit and keeps the editor open. No page-level Save button.
 */
export function RecordFieldCell({
  objectNamePlural,
  recordId,
  field,
  value,
  variant = 'stacked',
  onChange,
}: {
  objectNamePlural: string;
  recordId: string;
  field: DataModelField;
  value: unknown;
  /** stacked = label above value (default form look); row = label left / value right (Table mode). */
  variant?: 'stacked' | 'row';
  /** Redirects the commit into local draft state instead of the API (create/edit sheet usage). */
  onChange?: (value: unknown) => void;
}) {
  const queryClient = useQueryClient();
  const key = friendlyFieldKey(field);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<unknown>(value);
  const [invalid, setInvalid] = useState(false);

  const save = useMutation({
    mutationFn: (v: unknown) => recordApi.update(objectNamePlural, recordId, { [key]: v }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['record', objectNamePlural, recordId] }),
  });

  function handleOpenChange(next: boolean): void {
    if (next) {
      setDraft(value);
      setInvalid(false);
      setOpen(true);
      return;
    }
    const norm = normalizeDraft(field, draft);
    if (!isFieldDraftValid(field, norm)) {
      setInvalid(true); // keep the editor open with an error
      return;
    }
    setOpen(false);
    if (JSON.stringify(norm) !== JSON.stringify(value ?? null)) {
      if (onChange) onChange(norm ?? null);
      else save.mutate(norm ?? null);
    }
  }

  const valueNode = <FieldValueDisplay field={field} value={value} />;
  const Icon = fieldIcon(field);

  return (
    <div className={cn(variant === 'row' ? 'flex items-center gap-1' : 'space-y-1')}>
      <span
        className={cn(
          'flex items-center gap-1 text-xs font-medium text-muted-foreground',
          variant === 'row' && 'w-22.5 shrink-0 truncate',
        )}
      >
        <Icon className="size-3.5 shrink-0" />
        <span className="truncate">{field.label}</span>
      </span>
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger
          nativeButton={false}
          render={
            <div
              role="button"
              tabIndex={0}
              className={cn(
                'flex min-h-8 min-w-0 cursor-pointer items-center rounded-md px-2 py-1 text-sm hover:bg-muted/60',
                variant === 'row' ? 'flex-1' : 'w-full',
              )}
            />
          }
        >
          {valueNode}
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-72"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && ENTER_COMMITS.has(field.type)) {
              e.preventDefault();
              handleOpenChange(false);
            }
          }}
        >
          <FieldInput field={field} value={draft} onChange={setDraft} />
          {invalid && <p className="mt-1.5 text-xs text-destructive">Enter a valid value.</p>}
        </PopoverContent>
      </Popover>
    </div>
  );
}
