import { Check, X } from 'lucide-react';
import { FieldMetadataType } from '@saasly/shared';
import type { DataModelField } from '@/lib/api-client';
import { formatFieldValue, getFieldValue, selectColor, selectLabel } from '../lib/field-values';
import { RecordChip } from './RecordChip';
import { RecordRelationCell } from './RecordRelationCell';
import { Tag } from './Tag';

/**
 * Read-only cell content — mirrors Twenty's per-type field displays (Tag for SELECT/MULTI_SELECT,
 * check/x + text for BOOLEAN, an avatar+name chip for the record's label-identifier field). Every
 * other type falls back to `formatFieldValue`'s plain text (see that file's doc comment for the
 * full list of types this doesn't attempt to prettify further, e.g. CURRENCY/ADDRESS/RELATION).
 */
export function RecordTableCellDisplay({
  field,
  record,
  isLabelIdentifier,
}: {
  field: DataModelField;
  record: Record<string, unknown>;
  isLabelIdentifier: boolean;
}) {
  const value = getFieldValue(field, record);

  if (isLabelIdentifier) {
    return <RecordChip name={formatFieldValue(field, record)} />;
  }

  if (value === null || value === undefined) return <span className="text-muted-foreground">—</span>;

  if (field.type === FieldMetadataType.BOOLEAN) {
    return (
      <span className="inline-flex items-center gap-1">
        {value ? <Check className="size-3.5" /> : <X className="size-3.5 text-muted-foreground" />}
        {value ? 'True' : 'False'}
      </span>
    );
  }

  if (field.type === FieldMetadataType.SELECT) {
    return <Tag label={selectLabel(field, value)} color={selectColor(field, value)} />;
  }

  if (field.type === FieldMetadataType.MULTI_SELECT) {
    const values = value as unknown[];
    if (values.length === 0) return <span className="text-muted-foreground">—</span>;
    return (
      <span className="inline-flex flex-wrap gap-1">
        {values.map((v, i) => (
          <Tag key={i} label={selectLabel(field, v)} color={selectColor(field, v)} />
        ))}
      </span>
    );
  }

  if (field.type === FieldMetadataType.RELATION && field.settings?.relationType !== 'ONE_TO_MANY') {
    return <RecordRelationCell field={field} id={String(value)} />;
  }

  return <span className="truncate">{formatFieldValue(field, record)}</span>;
}
