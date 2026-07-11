import { useState } from 'react';
import { FieldMetadataType, type SelectOption } from '@saasly/shared';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { DataModelField } from '@/lib/api-client';
import { friendlyFieldKey, getFieldValue } from '../lib/field-values';
import { RecordTableCellDisplay } from './RecordTableCellDisplay';

/**
 * Field types edited directly in the cell (click-to-edit in place, like Twenty) — everything else
 * (composite types, RELATION target-picking) opens the full record dialog instead, since a faithful
 * in-cell editor for those needs more UI than a table cell reasonably fits. See task-list.md.
 */
const INLINE_EDITABLE_TYPES: ReadonlySet<string> = new Set([
  FieldMetadataType.TEXT,
  FieldMetadataType.NUMBER,
  FieldMetadataType.DATE,
  FieldMetadataType.DATE_TIME,
  FieldMetadataType.SELECT,
]);

export function isInlineEditable(field: DataModelField): boolean {
  return INLINE_EDITABLE_TYPES.has(field.type) || field.type === FieldMetadataType.BOOLEAN;
}

export function RecordTableCellEditable({
  field,
  record,
  isLabelIdentifier,
  onSave,
  onOpenDialog,
}: {
  field: DataModelField;
  record: Record<string, unknown>;
  isLabelIdentifier: boolean;
  onSave: (value: unknown) => void;
  onOpenDialog: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const key = friendlyFieldKey(field);
  const value = getFieldValue(field, record);

  if (field.type === FieldMetadataType.BOOLEAN) {
    return (
      <Checkbox
        checked={value === true}
        onCheckedChange={(checked) => onSave(checked === true)}
        onClick={(e) => e.stopPropagation()}
      />
    );
  }

  if (!editing) {
    return (
      <div
        className="flex h-full w-full items-center"
        onClick={() => (isInlineEditable(field) ? setEditing(true) : onOpenDialog())}
      >
        <RecordTableCellDisplay field={field} record={record} isLabelIdentifier={isLabelIdentifier} />
      </div>
    );
  }

  function commit(next: unknown): void {
    onSave(next);
    setEditing(false);
  }

  if (field.type === FieldMetadataType.SELECT) {
    const options = (field.settings?.options as SelectOption[] | undefined) ?? [];
    return (
      <Select
        defaultOpen
        value={(value as string) ?? undefined}
        onValueChange={(v) => commit(v)}
        onOpenChange={(open) => !open && setEditing(false)}
      >
        <SelectTrigger className="h-7 w-full border-0 shadow-none">
          <SelectValue placeholder="—" />
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

  const inputType =
    field.type === FieldMetadataType.NUMBER
      ? 'number'
      : field.type === FieldMetadataType.DATE
        ? 'date'
        : field.type === FieldMetadataType.DATE_TIME
          ? 'datetime-local'
          : 'text';

  return (
    <Input
      key={key}
      autoFocus
      type={inputType}
      defaultValue={(value as string | number) ?? ''}
      className="h-7 border-0 shadow-none focus-visible:ring-1"
      onBlur={(e) => commit(inputType === 'number' ? Number(e.target.value) : e.target.value || null)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') setEditing(false);
      }}
    />
  );
}
