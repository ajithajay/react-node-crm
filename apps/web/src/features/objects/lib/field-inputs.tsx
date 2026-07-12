import { FieldMetadataType, type SelectOption } from '@saasly/shared';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { DataModelField } from '@/lib/api-client';
import { RelationPickerInput } from '../components/RelationPickerInput';
import { RichTextEditor } from '../components/RichTextEditor';

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
      return <Input type="date" value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value || null)} />;
    case FieldMetadataType.DATE_TIME:
      return (
        <Input
          type="datetime-local"
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value ? new Date(e.target.value).toISOString() : null)}
        />
      );
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
    case FieldMetadataType.CURRENCY:
      return (
        <div className="grid grid-cols-2 gap-2">
          <CompositeSubInput label="Amount (micros)" value={obj.amountMicros} onChange={setSub('amountMicros')} />
          <CompositeSubInput label="Currency code" value={obj.currencyCode} onChange={setSub('currencyCode')} />
        </div>
      );
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
