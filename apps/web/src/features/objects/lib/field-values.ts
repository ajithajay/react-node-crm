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

/**
 * A record's human display label, resolving through the composite-aware `formatFieldValue` and
 * degrading gracefully — label field → an email field → `Unnamed <object>` — but never to a raw
 * UUID (gap A2). Shared by the relation picker and the table's relation cell so the fallback logic
 * stays in one place.
 */
export function resolveRecordLabel(
  record: Record<string, unknown>,
  labelField: DataModelField | undefined,
  fields: DataModelField[] | undefined,
  objectLabelSingular: string | undefined,
): string {
  if (labelField) {
    const formatted = formatFieldValue(labelField, record);
    if (formatted !== '—') return formatted;
  }
  const emailField = fields?.find((f) => f.type === FieldMetadataType.EMAILS || f.name === 'email');
  if (emailField) {
    const email = formatFieldValue(emailField, record);
    if (email !== '—') return email;
  }
  return `Unnamed ${objectLabelSingular ?? 'record'}`;
}

/** Prepend https:// when a URL has no scheme (Twenty's ensureAbsoluteUrl). */
export function ensureAbsoluteUrl(raw: string): string {
  const t = raw.trim();
  if (!t) return t;
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
}

/** Twenty's absolute-URL rule: empty ok (clears the field); reject pure-numeric hosts; must parse. */
export function isValidUrl(raw: string): boolean {
  const t = raw.trim();
  if (!t) return true;
  if (/^\d+$/.test(t)) return false;
  try {
    const u = new URL(ensureAbsoluteUrl(t));
    return !!u.hostname && u.hostname.includes('.');
  } catch {
    return false;
  }
}

/**
 * Whether a per-field draft value is persistable (mirrors Twenty's per-input `skipPersist` gate).
 * Returns false to block the save and keep the editor in an error state.
 */
export function isFieldDraftValid(field: DataModelField, draft: unknown): boolean {
  switch (field.type) {
    case FieldMetadataType.LINKS: {
      const url = (draft as { primaryLinkUrl?: string } | null)?.primaryLinkUrl ?? '';
      return isValidUrl(url);
    }
    case FieldMetadataType.NUMBER:
    case FieldMetadataType.RATING:
      return draft === null || draft === undefined || draft === '' || !Number.isNaN(Number(draft));
    default:
      return true;
  }
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

  if (field.type === FieldMetadataType.ACTOR) {
    const v = value as Record<string, unknown>;
    return (v.name as string | null) || '—';
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
