import type { FieldMetadataEntity } from '@saasly/database';
import { FieldMetadataType, toCamelCase } from '@saasly/shared';
import { parseCsv, stringifyCsv } from '../../lib/csv.js';
import { COMPOSITE_SHAPE, SKIP_FIELD_NAMES } from './record-field-codec.js';

export interface CsvColumn {
  header: string;
  field: FieldMetadataEntity;
  /** Present for a composite field's sub-value, e.g. `amountMicros` for a CURRENCY column. */
  subKey?: string;
}

/** Fields with no meaningful single value to put in a cell (see record-field-codec.ts's decode exclusions). */
function isExportableField(field: FieldMetadataEntity): boolean {
  if (SKIP_FIELD_NAMES.has(field.name)) return false;
  if (field.type === FieldMetadataType.MORPH_RELATION) return false;
  if (field.type === FieldMetadataType.RELATION && field.settings?.relationType === 'ONE_TO_MANY') return false;
  return true;
}

/** The exact flattened column list this object's CSV will have — same for export and import, so a
 * round-tripped export/import always lines up. `id`/`createdAt`/`updatedAt` always lead. */
export function buildCsvColumns(fields: FieldMetadataEntity[], restrictedForRead: ReadonlySet<string>): CsvColumn[] {
  const columns: CsvColumn[] = [];
  const exportable = fields.filter((f) => isExportableField(f) && !restrictedForRead.has(f.id));

  for (const field of exportable) {
    const key = field.type === FieldMetadataType.RELATION ? `${toCamelCase(field.name)}Id` : toCamelCase(field.name);
    const shape = COMPOSITE_SHAPE[field.type];
    if (shape) {
      for (const sub of shape) columns.push({ header: `${key}.${sub.key}`, field, subKey: sub.key });
    } else {
      columns.push({ header: key, field });
    }
  }
  return columns;
}

function cellToString(field: FieldMetadataEntity, subKey: string | undefined, value: unknown): string {
  if (value === null || value === undefined) return '';
  if (subKey) return typeof value === 'string' ? value : JSON.stringify(value);

  switch (field.type) {
    case FieldMetadataType.MULTI_SELECT:
      return (value as string[]).join(';');
    case FieldMetadataType.RAW_JSON:
    case FieldMetadataType.ARRAY:
      return JSON.stringify(value);
    case FieldMetadataType.BOOLEAN:
      return value ? 'true' : 'false';
    default:
      return String(value);
  }
}

function cellFromString(field: FieldMetadataEntity, subKey: string | undefined, raw: string): unknown {
  if (raw === '') return null;
  if (subKey) {
    if (subKey === 'additionalEmails' || subKey === 'additionalPhones' || subKey === 'secondaryLinks') {
      try {
        return JSON.parse(raw) as unknown;
      } catch {
        return null;
      }
    }
    return raw;
  }

  switch (field.type) {
    case FieldMetadataType.NUMBER:
    case FieldMetadataType.RATING:
      return Number(raw);
    case FieldMetadataType.BOOLEAN:
      return raw.toLowerCase() === 'true' || raw === '1';
    case FieldMetadataType.MULTI_SELECT:
      return raw
        .split(';')
        .map((v) => v.trim())
        .filter(Boolean);
    case FieldMetadataType.RAW_JSON:
    case FieldMetadataType.ARRAY:
      try {
        return JSON.parse(raw) as unknown;
      } catch {
        return raw;
      }
    default:
      return raw;
  }
}

export function recordsToCsv(columns: CsvColumn[], records: Record<string, unknown>[]): string {
  const header = columns.map((c) => c.header);
  const rows = records.map((record) =>
    columns.map((c) => {
      const key = c.field.type === FieldMetadataType.RELATION ? `${toCamelCase(c.field.name)}Id` : toCamelCase(c.field.name);
      const value = c.subKey ? (record[key] as Record<string, unknown> | null)?.[c.subKey] : record[key];
      return cellToString(c.field, c.subKey, value);
    }),
  );
  return stringifyCsv([header, ...rows]);
}

/** Parses CSV text into per-row bodies shaped exactly like `decodeRecord`'s output, ready for `encodeRecordInput`. */
export function csvToRecordBodies(columns: CsvColumn[], csvText: string): Record<string, unknown>[] {
  const rows = parseCsv(csvText);
  if (rows.length === 0) return [];
  const header = rows[0]!;
  const columnByHeader = new Map(columns.map((c) => [c.header, c]));

  return rows.slice(1).map((row) => {
    const body: Record<string, unknown> = {};
    header.forEach((headerName, i) => {
      const column = columnByHeader.get(headerName);
      if (!column) return;
      const raw = row[i] ?? '';
      const value = cellFromString(column.field, column.subKey, raw);
      const key = column.field.type === FieldMetadataType.RELATION ? `${toCamelCase(column.field.name)}Id` : toCamelCase(column.field.name);
      if (column.subKey) {
        const existing = (body[key] as Record<string, unknown> | undefined) ?? {};
        existing[column.subKey] = value;
        body[key] = existing;
      } else {
        body[key] = value;
      }
    });
    return body;
  });
}
