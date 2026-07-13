import { format } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';
import { CURRENCIES, DEFAULT_CURRENCY_CODE, FieldMetadataType, type SelectOption } from '@saasly/shared';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { DataModelField } from '@/lib/api-client';
import { RelationPickerInput } from '../components/RelationPickerInput';
import { RichTextEditor } from '../components/RichTextEditor';

/** A shadcn calendar-based picker for DATE/DATE_TIME fields — DATE stores a plain `yyyy-MM-dd`
 * string, DATE_TIME an ISO datetime string (same value contracts the native inputs used). */
function DateFieldInput({
  isDateTime,
  value,
  onChange,
}: {
  isDateTime: boolean;
  value: unknown;
  onChange: (v: string | null) => void;
}) {
  const dateValue = value ? new Date(value as string) : undefined;
  const timeValue = dateValue ? format(dateValue, 'HH:mm') : '';

  function commitDate(next: Date | undefined): void {
    if (!next) {
      onChange(null);
      return;
    }
    if (!isDateTime) {
      onChange(format(next, 'yyyy-MM-dd'));
      return;
    }
    const merged = new Date(next);
    if (dateValue) merged.setHours(dateValue.getHours(), dateValue.getMinutes(), 0, 0);
    onChange(merged.toISOString());
  }

  function commitTime(time: string): void {
    if (!dateValue || !time) return;
    const [hours, minutes] = time.split(':').map(Number);
    const merged = new Date(dateValue);
    merged.setHours(hours ?? 0, minutes ?? 0, 0, 0);
    onChange(merged.toISOString());
  }

  return (
    <div className="flex items-center gap-2">
      <Popover>
        <PopoverTrigger
          render={<Button variant="outline" size="sm" className="justify-start gap-1.5 font-normal" />}
        >
          <CalendarIcon className="size-3.5" />
          {dateValue ? format(dateValue, 'PP') : <span className="text-muted-foreground">Pick a date</span>}
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0">
          <Calendar mode="single" selected={dateValue} onSelect={commitDate} />
        </PopoverContent>
      </Popover>
      {isDateTime && (
        <Input
          type="time"
          value={timeValue}
          onChange={(e) => commitTime(e.target.value)}
          disabled={!dateValue}
          className="w-28"
        />
      )}
    </div>
  );
}

/** Field types not offered in the create/edit form — system-managed, polymorphic-target, or reverse-only. */
const EXCLUDED_TYPES: ReadonlySet<string> = new Set([
  FieldMetadataType.ACTOR,
  FieldMetadataType.MORPH_RELATION,
  FieldMetadataType.FILES,
]);

export function isEditableField(field: DataModelField): boolean {
  if (EXCLUDED_TYPES.has(field.type)) return false;
  if (field.type === FieldMetadataType.RELATION && field.settings?.relationType === 'ONE_TO_MANY') return false;
  if (['created_at', 'updated_at', 'deleted_at'].includes(field.name)) return false;
  return true;
}

/** A collection/reverse relation (People, Opportunities) — rendered as its own FIELD widget. */
export function isReverseRelationField(field: DataModelField): boolean {
  return (
    field.type === FieldMetadataType.RELATION &&
    field.settings?.relationType === 'ONE_TO_MANY' &&
    !field.settings?.isMorphReverse
  );
}

/** Fields a standalone FIELD widget can display: editable scalars/forward-relations + reverse relations. */
export function isFieldWidgetPickable(field: DataModelField): boolean {
  return isEditableField(field) || isReverseRelationField(field);
}

/**
 * Which FIELD-widget display modes a field type supports (Twenty parity): a scalar field only has
 * "Field"; a to-one relation adds "Card"; a to-many relation adds "Card" and "Table".
 */
export function displayModesForField(field: DataModelField): ('PLAIN' | 'CARD' | 'TABLE')[] {
  if (field.type === FieldMetadataType.RELATION) {
    return field.settings?.relationType === 'ONE_TO_MANY' ? ['PLAIN', 'CARD', 'TABLE'] : ['PLAIN', 'CARD'];
  }
  return ['PLAIN'];
}

function CompositeSubInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: unknown;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

export function FieldInput({
  field,
  value,
  onChange,
}: {
  field: DataModelField;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const obj = (value ?? {}) as Record<string, unknown>;
  const setSub = (key: string) => (v: string) => onChange({ ...obj, [key]: v || null });

  switch (field.type) {
    case FieldMetadataType.BOOLEAN:
      return <Checkbox checked={value === true} onCheckedChange={(c) => onChange(c === true)} />;
    case FieldMetadataType.NUMBER:
    case FieldMetadataType.RATING:
      return (
        <Input
          type="number"
          value={(value as number | string) ?? ''}
          onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
        />
      );
    case FieldMetadataType.DATE:
      return <DateFieldInput isDateTime={false} value={value} onChange={onChange} />;
    case FieldMetadataType.DATE_TIME:
      return <DateFieldInput isDateTime value={value} onChange={onChange} />;
    case FieldMetadataType.SELECT: {
      const options = (field.settings?.options as SelectOption[] | undefined) ?? [];
      return (
        <Select value={(value as string) ?? undefined} onValueChange={(v) => onChange(v)}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select…" />
          </SelectTrigger>
          <SelectContent>
            {options.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }
    case FieldMetadataType.MULTI_SELECT:
      return (
        <Input
          placeholder="comma, separated, values"
          value={Array.isArray(value) ? (value as string[]).join(', ') : ''}
          onChange={(e) =>
            onChange(
              e.target.value
                .split(',')
                .map((v) => v.trim())
                .filter(Boolean),
            )
          }
        />
      );
    case FieldMetadataType.CURRENCY: {
      const amountMicros = obj.amountMicros as number | string | null | undefined;
      const amountValue = amountMicros == null || amountMicros === '' ? '' : Number(amountMicros) / 1_000_000;
      const currencyCode = (obj.currencyCode as string | undefined) ?? DEFAULT_CURRENCY_CODE;
      return (
        <div className="flex items-center gap-2">
          <Select value={currencyCode} onValueChange={(v) => onChange({ ...obj, currencyCode: v })}>
            <SelectTrigger className="w-24 shrink-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CURRENCIES.map((c) => (
                <SelectItem key={c.code} value={c.code}>
                  {c.code}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="number"
            placeholder="0.00"
            value={amountValue}
            onChange={(e) =>
              onChange({
                ...obj,
                currencyCode,
                amountMicros: e.target.value === '' ? null : Math.round(Number(e.target.value) * 1_000_000),
              })
            }
          />
        </div>
      );
    }
    case FieldMetadataType.EMAILS:
      return <CompositeSubInput label="Primary email" value={obj.primaryEmail} onChange={setSub('primaryEmail')} />;
    case FieldMetadataType.LINKS:
      return <CompositeSubInput label="URL" value={obj.primaryLinkUrl} onChange={setSub('primaryLinkUrl')} />;
    case FieldMetadataType.PHONES:
      return <CompositeSubInput label="Phone number" value={obj.primaryPhoneNumber} onChange={setSub('primaryPhoneNumber')} />;
    case FieldMetadataType.FULL_NAME:
      return (
        <div className="grid grid-cols-2 gap-2">
          <CompositeSubInput label="First name" value={obj.firstName} onChange={setSub('firstName')} />
          <CompositeSubInput label="Last name" value={obj.lastName} onChange={setSub('lastName')} />
        </div>
      );
    case FieldMetadataType.ADDRESS:
      return (
        <div className="grid grid-cols-2 gap-2">
          <CompositeSubInput label="Street" value={obj.street1} onChange={setSub('street1')} />
          <CompositeSubInput label="City" value={obj.city} onChange={setSub('city')} />
          <CompositeSubInput label="State" value={obj.state} onChange={setSub('state')} />
          <CompositeSubInput label="Country" value={obj.country} onChange={setSub('country')} />
        </div>
      );
    case FieldMetadataType.RICH_TEXT:
      return (
        <RichTextEditor
          value={obj as { blocknote?: unknown; markdown?: string | null }}
          onChange={(v) => onChange(v)}
        />
      );
    case FieldMetadataType.RELATION:
      return <RelationPickerInput field={field} value={(value as string) ?? null} onChange={onChange} />;
    default:
      return <Input value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} />;
  }
}
