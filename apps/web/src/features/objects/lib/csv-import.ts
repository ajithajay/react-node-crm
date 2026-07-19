import { FieldMetadataType, type SelectOption } from '@saasly/shared';
import type { DataModelField } from '@/lib/api-client';
import { friendlyFieldKey } from './field-values';

/** Mirrors apps/api/src/modules/record/record-field-codec.ts's COMPOSITE_SHAPE — just the sub-key
 *  names, since a composite column's CSV header is `${fieldKey}.${subKey}` (record-csv.ts). */
const COMPOSITE_SUBKEYS: Partial<Record<string, string[]>> = {
  [FieldMetadataType.CURRENCY]: ['amountMicros', 'currencyCode'],
  [FieldMetadataType.EMAILS]: ['primaryEmail', 'additionalEmails'],
  [FieldMetadataType.LINKS]: ['primaryLinkUrl', 'primaryLinkLabel', 'secondaryLinks'],
  [FieldMetadataType.PHONES]: [
    'primaryPhoneCallingCode',
    'primaryPhoneCountryCode',
    'primaryPhoneNumber',
    'additionalPhones',
  ],
  [FieldMetadataType.FULL_NAME]: ['firstName', 'lastName'],
  [FieldMetadataType.ADDRESS]: ['street1', 'street2', 'city', 'state', 'country', 'postcode', 'lat', 'lng'],
  [FieldMetadataType.RICH_TEXT]: ['blocknote', 'markdown'],
};

/** Field types the import wizard validates cell-by-cell (mirrors record-csv.ts's `cellFromString` rules). */
const VALIDATABLE_TYPES: ReadonlySet<string> = new Set([
  FieldMetadataType.NUMBER,
  FieldMetadataType.RATING,
  FieldMetadataType.DATE,
  FieldMetadataType.DATE_TIME,
  FieldMetadataType.SELECT,
  FieldMetadataType.MULTI_SELECT,
]);

export interface ImportTargetColumn {
  /** The canonical header the backend expects, e.g. `annualRevenue.amountMicros` or `ownerId`. */
  header: string;
  fieldId: string;
  fieldLabel: string;
  fieldType: string;
  /** Present for a composite field's sub-column. */
  subKey?: string;
  /** SELECT/MULTI_SELECT's configured options, for validating a cell's value against them. */
  selectOptions?: SelectOption[];
}

/** ACTOR fields (createdBy/updatedBy) are export-only — encodeRecordInput ignores them on import,
 *  so they aren't offered as a mapping target. Reverse relations (ONE_TO_MANY) aren't writable either. */
function isImportableField(field: DataModelField): boolean {
  if (field.type === FieldMetadataType.ACTOR || field.type === FieldMetadataType.MORPH_RELATION) return false;
  if (field.type === FieldMetadataType.RELATION && field.settings?.relationType === 'ONE_TO_MANY') return false;
  return field.isActive;
}

/** Every column the backend will accept for this object, in the same shape/order as `buildCsvColumns`. */
export function buildImportTargetColumns(fields: DataModelField[]): ImportTargetColumn[] {
  const columns: ImportTargetColumn[] = [];
  for (const field of fields.filter(isImportableField)) {
    const key = friendlyFieldKey(field);
    const subKeys = COMPOSITE_SUBKEYS[field.type];
    if (subKeys) {
      for (const subKey of subKeys) {
        columns.push({
          header: `${key}.${subKey}`,
          fieldId: field.id,
          fieldLabel: `${field.label} (${subKey})`,
          fieldType: field.type,
          subKey,
        });
      }
    } else {
      const selectOptions = (field.settings?.options as SelectOption[] | undefined) ?? undefined;
      columns.push({ header: key, fieldId: field.id, fieldLabel: field.label, fieldType: field.type, selectOptions });
    }
  }
  return columns;
}

/** Case/whitespace-insensitive match against a target column's canonical header. */
export function autoMatchTarget(csvHeader: string, targets: ImportTargetColumn[]): ImportTargetColumn | null {
  const normalized = csvHeader.trim().toLowerCase();
  return targets.find((t) => t.header.toLowerCase() === normalized) ?? null;
}

/** `null` if the cell is valid (or not a validated type); otherwise a short user-facing message. */
export function validateCell(target: ImportTargetColumn, raw: string): string | null {
  if (target.subKey || !VALIDATABLE_TYPES.has(target.fieldType) || raw.trim() === '') return null;

  switch (target.fieldType) {
    case FieldMetadataType.NUMBER:
    case FieldMetadataType.RATING:
      return Number.isNaN(Number(raw)) ? `"${raw}" is not a number` : null;
    case FieldMetadataType.DATE:
    case FieldMetadataType.DATE_TIME:
      return Number.isNaN(Date.parse(raw)) ? `"${raw}" is not a valid date` : null;
    case FieldMetadataType.SELECT: {
      const options = (target.selectOptions ?? []).map((o) => o.value);
      return options.length > 0 && !options.includes(raw) ? `"${raw}" is not one of this field's options` : null;
    }
    case FieldMetadataType.MULTI_SELECT: {
      const options = (target.selectOptions ?? []).map((o) => o.value);
      if (options.length === 0) return null;
      const values = raw.split(';').map((v) => v.trim()).filter(Boolean);
      const bad = values.find((v) => !options.includes(v));
      return bad ? `"${bad}" is not one of this field's options` : null;
    }
    default:
      return null;
  }
}

/** Minimal RFC4180 CSV parser (mirrors apps/api/src/lib/csv.ts so client/server agree on quoting rules). */
export function parseCsvClient(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const char = text[i]!;
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += char;
      i += 1;
      continue;
    }
    if (char === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (char === ',') {
      row.push(field);
      field = '';
      i += 1;
      continue;
    }
    if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      i += 1;
      continue;
    }
    field += char;
    i += 1;
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => !(r.length === 1 && r[0] === ''));
}

function csvField(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function stringifyCsvClient(rows: string[][]): string {
  return rows.map((row) => row.map(csvField).join(',')).join('\r\n');
}
