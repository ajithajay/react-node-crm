import type { FieldMetadataEntity } from '@saasly/database';
import { FieldMetadataType, toCamelCase } from '@saasly/shared';
import { ForbiddenError } from '../../lib/errors.js';

/** Metadata-only rows already surfaced via the fixed system columns (see entity-schema.factory.ts). */
export const SKIP_FIELD_NAMES: ReadonlySet<string> = new Set(['id', 'position', 'created_at', 'updated_at', 'deleted_at']);

type Row = Record<string, unknown>;
const col = (row: Row, name: string): unknown => row[name];

export interface CompositeSubField {
  /** Friendly (camelCase) key in the JSON payload. */
  key: string;
  /** Physical column suffix, e.g. `amount_micros` for `<name>_amount_micros`. */
  suffix: string;
}

/** Exported for record-csv.ts, which needs the identical per-type sub-key shape to flatten/unflatten columns. */
export const COMPOSITE_SHAPE: Partial<Record<FieldMetadataType, CompositeSubField[]>> = {
  [FieldMetadataType.CURRENCY]: [
    { key: 'amountMicros', suffix: 'amount_micros' },
    { key: 'currencyCode', suffix: 'currency_code' },
  ],
  [FieldMetadataType.EMAILS]: [
    { key: 'primaryEmail', suffix: 'primary_email' },
    { key: 'additionalEmails', suffix: 'additional_emails' },
  ],
  [FieldMetadataType.LINKS]: [
    { key: 'primaryLinkUrl', suffix: 'primary_link_url' },
    { key: 'primaryLinkLabel', suffix: 'primary_link_label' },
    { key: 'secondaryLinks', suffix: 'secondary_links' },
  ],
  [FieldMetadataType.PHONES]: [
    { key: 'primaryPhoneCallingCode', suffix: 'primary_phone_calling_code' },
    { key: 'primaryPhoneCountryCode', suffix: 'primary_phone_country_code' },
    { key: 'primaryPhoneNumber', suffix: 'primary_phone_number' },
    { key: 'additionalPhones', suffix: 'additional_phones' },
  ],
  [FieldMetadataType.FULL_NAME]: [
    { key: 'firstName', suffix: 'first_name' },
    { key: 'lastName', suffix: 'last_name' },
  ],
  [FieldMetadataType.ADDRESS]: [
    { key: 'street1', suffix: 'street1' },
    { key: 'street2', suffix: 'street2' },
    { key: 'city', suffix: 'city' },
    { key: 'state', suffix: 'state' },
    { key: 'country', suffix: 'country' },
    { key: 'postcode', suffix: 'postcode' },
    { key: 'lat', suffix: 'lat' },
    { key: 'lng', suffix: 'lng' },
  ],
  [FieldMetadataType.RICH_TEXT]: [
    { key: 'blocknote', suffix: 'blocknote' },
    { key: 'markdown', suffix: 'markdown' },
  ],
  [FieldMetadataType.ACTOR]: [
    { key: 'source', suffix: 'source' },
    { key: 'workspaceMemberId', suffix: 'workspace_member_id' },
    { key: 'name', suffix: 'name' },
    { key: 'context', suffix: 'context' },
  ],
};

/**
 * Decodes one raw workspace-table row (TypeORM entity instance, camelCase system columns + the
 * exact per-field column names from entity-column-mapper.ts) into a friendly camelCase JSON object.
 * `restrictedForRead` is a set of fieldMetadataIds to omit entirely (field-level permission restriction).
 */
export function decodeRecord(
  fields: FieldMetadataEntity[],
  row: Row,
  restrictedForRead: ReadonlySet<string>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {
    id: row.id,
    position: row.position,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt ?? null,
  };

  for (const field of fields) {
    if (SKIP_FIELD_NAMES.has(field.name) || restrictedForRead.has(field.id)) continue;
    const key = toCamelCase(field.name);

    if (field.type === FieldMetadataType.RELATION) {
      if (field.settings?.relationType === 'ONE_TO_MANY') continue; // reverse side — no column (needs a join; deferred)
      out[`${key}Id`] = col(row, `${field.name}_id`) ?? null;
      continue;
    }
    if (field.type === FieldMetadataType.MORPH_RELATION) {
      out[`${key}Type`] = col(row, `${field.name}_target_type`) ?? null;
      out[`${key}Id`] = col(row, `${field.name}_target_id`) ?? null;
      continue;
    }

    const shape = COMPOSITE_SHAPE[field.type];
    if (shape) {
      out[key] = Object.fromEntries(
        shape.map((sub) => [sub.key, col(row, `${field.name}_${sub.suffix}`) ?? null]),
      );
      continue;
    }

    out[key] = col(row, field.name) ?? null;
  }

  return out;
}

function assertWritable(field: FieldMetadataEntity, restrictedForWrite: ReadonlySet<string>): void {
  if (restrictedForWrite.has(field.id)) {
    throw new ForbiddenError(`Field "${field.label}" is restricted for your role`);
  }
}

/**
 * Encodes a friendly camelCase JSON body into entity property values ready for
 * `repository.create()`/`.save()`. Only keys present in `body` are touched (partial-update safe).
 * ACTOR fields are never client-writable (system-managed — see record.service.ts) and
 * reverse RELATION fields are read-only in this v1. MORPH_RELATION fields
 * accept `${key}Type`/`${key}Id` (e.g. `targetType`/`targetId`) written together.
 */
export function encodeRecordInput(
  fields: FieldMetadataEntity[],
  body: Record<string, unknown>,
  restrictedForWrite: ReadonlySet<string>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  for (const field of fields) {
    if (SKIP_FIELD_NAMES.has(field.name) || field.type === FieldMetadataType.ACTOR) continue;

    const key = toCamelCase(field.name);

    if (field.type === FieldMetadataType.MORPH_RELATION) {
      const typeKey = `${key}Type`;
      const idKey = `${key}Id`;
      if (!(typeKey in body) && !(idKey in body)) continue;
      assertWritable(field, restrictedForWrite);
      out[`${field.name}_target_type`] = body[typeKey] ?? null;
      out[`${field.name}_target_id`] = body[idKey] ?? null;
      continue;
    }

    if (field.type === FieldMetadataType.RELATION) {
      if (field.settings?.relationType === 'ONE_TO_MANY') continue;
      const relKey = `${key}Id`;
      if (!(relKey in body)) continue;
      assertWritable(field, restrictedForWrite);
      out[`${field.name}_id`] = body[relKey] ?? null;
      continue;
    }

    const shape = COMPOSITE_SHAPE[field.type];
    if (shape) {
      if (!(key in body)) continue;
      assertWritable(field, restrictedForWrite);
      const value = (body[key] ?? {}) as Record<string, unknown>;
      for (const sub of shape) out[`${field.name}_${sub.suffix}`] = value[sub.key] ?? null;
      continue;
    }

    if (!(key in body)) continue;
    assertWritable(field, restrictedForWrite);
    out[field.name] = body[key];
  }

  return out;
}
