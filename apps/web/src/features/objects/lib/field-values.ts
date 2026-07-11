import { FieldMetadataType, toCamelCase, ViewFilterOperand, type SelectOption } from '@saasly/shared';
import type { DataModelField } from '@/lib/api-client';

/** Field types whose value lives under a single friendly JSON key (mirrors record-field-codec.ts). */
const COMPOSITE_TYPES: ReadonlySet<string> = new Set([
  FieldMetadataType.CURRENCY,
  FieldMetadataType.EMAILS,
  FieldMetadataType.LINKS,
  FieldMetadataType.PHONES,
  FieldMetadataType.FULL_NAME,
  FieldMetadataType.ADDRESS,
  FieldMetadataType.RICH_TEXT,
]);

/** Field types the record API will filter/sort/search on (mirrors query-parser.ts's buildFilterableFieldIndex). */
export const FILTERABLE_TYPES: ReadonlySet<string> = new Set([
  FieldMetadataType.TEXT,
  FieldMetadataType.NUMBER,
  FieldMetadataType.BOOLEAN,
  FieldMetadataType.DATE_TIME,
  FieldMetadataType.DATE,
  FieldMetadataType.SELECT,
  FieldMetadataType.MULTI_SELECT,
  FieldMetadataType.RATING,
  FieldMetadataType.FILES,
  FieldMetadataType.RAW_JSON,
  FieldMetadataType.ARRAY,
  FieldMetadataType.UUID,
  FieldMetadataType.RELATION,
]);

const TEXT_OPERANDS = [ViewFilterOperand.CONTAINS, ViewFilterOperand.DOES_NOT_CONTAIN];
const COMPARABLE_OPERANDS = [ViewFilterOperand.LESS_THAN_OR_EQUAL, ViewFilterOperand.GREATER_THAN_OR_EQUAL];
const DATE_OPERANDS = [ViewFilterOperand.IS_BEFORE, ViewFilterOperand.IS_AFTER, ViewFilterOperand.IS_RELATIVE];
const BASE_OPERANDS = [ViewFilterOperand.IS, ViewFilterOperand.IS_NOT, ViewFilterOperand.IS_EMPTY, ViewFilterOperand.IS_NOT_EMPTY];

/** Which ViewFilterOperand values are valid for a given field type (mirrors query-parser.ts's applyCondition guards). */
export function operandsForType(type: string): string[] {
  switch (type) {
    case FieldMetadataType.TEXT:
      return [...BASE_OPERANDS, ...TEXT_OPERANDS];
    case FieldMetadataType.NUMBER:
    case FieldMetadataType.RATING:
      return [...BASE_OPERANDS, ...COMPARABLE_OPERANDS];
    case FieldMetadataType.DATE:
    case FieldMetadataType.DATE_TIME:
      return [...BASE_OPERANDS, ...COMPARABLE_OPERANDS, ...DATE_OPERANDS];
    default:
      return [...BASE_OPERANDS];
  }
}

/** The friendly JSON key a field's value lives under in a decoded record (see record-field-codec.ts). */
export function friendlyFieldKey(field: Pick<DataModelField, 'name' | 'type'>): string {
  const key = toCamelCase(field.name);
  return field.type === FieldMetadataType.RELATION ? `${key}Id` : key;
}

export function selectLabel(field: DataModelField, value: unknown): string {
  const options = (field.settings?.options as SelectOption[] | undefined) ?? [];
  return options.find((o) => o.value === value)?.label ?? String(value);
}

export function selectColor(field: DataModelField, value: unknown): string | undefined {
  const options = (field.settings?.options as SelectOption[] | undefined) ?? [];
  return options.find((o) => o.value === value)?.color;
}

/** The raw (undecorated) friendly-key value for a field, straight off the decoded record. */
export function getFieldValue(field: DataModelField, record: Record<string, unknown>): unknown {
  return record[friendlyFieldKey(field)];
}

/** Renders a field's value as plain display text for a table cell. */
export function formatFieldValue(field: DataModelField, record: Record<string, unknown>): string {
  const key = friendlyFieldKey(field);
  const value = record[key];
  if (value === null || value === undefined) return '—';

  if (COMPOSITE_TYPES.has(field.type)) {
    const v = value as Record<string, unknown>;
    switch (field.type) {
      case FieldMetadataType.CURRENCY: {
        if (v.amountMicros == null) return '—';
        const amount = Number(v.amountMicros) / 1_000_000;
        return `${v.currencyCode ?? ''} ${amount.toLocaleString()}`.trim();
      }
      case FieldMetadataType.EMAILS:
        return (v.primaryEmail as string | null) ?? '—';
      case FieldMetadataType.LINKS:
        return (v.primaryLinkUrl as string | null) ?? '—';
      case FieldMetadataType.PHONES:
        return (v.primaryPhoneNumber as string | null) ?? '—';
      case FieldMetadataType.FULL_NAME:
        return `${v.firstName ?? ''} ${v.lastName ?? ''}`.trim() || '—';
      case FieldMetadataType.ADDRESS:
        return [v.city, v.state, v.country].filter(Boolean).join(', ') || '—';
      case FieldMetadataType.RICH_TEXT:
        return (v.markdown as string | null)?.slice(0, 80) || '—';
      default:
        return '—';
    }
  }

  switch (field.type) {
    case FieldMetadataType.BOOLEAN:
      return value ? 'Yes' : 'No';
    case FieldMetadataType.DATE:
      return new Date(value as string).toLocaleDateString();
    case FieldMetadataType.DATE_TIME:
      return new Date(value as string).toLocaleString();
    case FieldMetadataType.SELECT:
      return selectLabel(field, value);
    case FieldMetadataType.MULTI_SELECT:
      return (value as unknown[]).map((v) => selectLabel(field, v)).join(', ') || '—';
    case FieldMetadataType.RELATION:
      return String(value).slice(0, 8);
    case FieldMetadataType.RAW_JSON:
    case FieldMetadataType.ARRAY:
      return JSON.stringify(value);
    default:
      return String(value);
  }
}
