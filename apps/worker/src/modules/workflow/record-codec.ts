import type { FieldMetadataEntity } from '@saasly/database';
import { FieldMetadataType, toCamelCase } from '@saasly/shared';

/**
 * Permission-free encode/decode between a friendly camelCase JSON body and workspace-table columns.
 * Mirrors the api's `record-field-codec.ts` COMPOSITE_SHAPE (the source of truth for column suffixes,
 * which match `field-column-mapper.ts`); duplicated here because workflows run with system authority
 * in the worker and must not depend on apps/api. Keep the shape map in sync with the api codec.
 */
const SKIP = new Set(['id', 'position', 'created_at', 'updated_at', 'deleted_at']);

interface Sub {
  key: string;
  suffix: string;
}
const COMPOSITE_SHAPE: Partial<Record<FieldMetadataType, Sub[]>> = {
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

type Row = Record<string, unknown>;

export function decodeRecord(fields: FieldMetadataEntity[], row: Row): Record<string, unknown> {
  const out: Record<string, unknown> = {
    id: row.id,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt ?? null,
  };
  for (const field of fields) {
    if (SKIP.has(field.name)) continue;
    const key = toCamelCase(field.name);
    if (field.type === FieldMetadataType.RELATION) {
      if (field.settings?.relationType === 'ONE_TO_MANY') continue;
      out[`${key}Id`] = row[`${field.name}_id`] ?? null;
      continue;
    }
    if (field.type === FieldMetadataType.MORPH_RELATION) {
      out[`${key}Type`] = row[`${field.name}_target_type`] ?? null;
      out[`${key}Id`] = row[`${field.name}_target_id`] ?? null;
      continue;
    }
    const shape = COMPOSITE_SHAPE[field.type];
    if (shape) {
      out[key] = Object.fromEntries(shape.map((s) => [s.key, row[`${field.name}_${s.suffix}`] ?? null]));
      continue;
    }
    out[key] = row[field.name] ?? null;
  }
  return out;
}

export function encodeRecordInput(
  fields: FieldMetadataEntity[],
  body: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const field of fields) {
    if (SKIP.has(field.name) || field.type === FieldMetadataType.ACTOR) continue;
    const key = toCamelCase(field.name);

    if (field.type === FieldMetadataType.MORPH_RELATION) {
      const typeKey = `${key}Type`;
      const idKey = `${key}Id`;
      if (!(typeKey in body) && !(idKey in body)) continue;
      out[`${field.name}_target_type`] = body[typeKey] ?? null;
      out[`${field.name}_target_id`] = body[idKey] ?? null;
      continue;
    }
    if (field.type === FieldMetadataType.RELATION) {
      if (field.settings?.relationType === 'ONE_TO_MANY') continue;
      const relKey = `${key}Id`;
      if (!(relKey in body)) continue;
      out[`${field.name}_id`] = body[relKey] ?? null;
      continue;
    }
    const shape = COMPOSITE_SHAPE[field.type];
    if (shape) {
      if (!(key in body)) continue;
      const value = (body[key] ?? {}) as Record<string, unknown>;
      for (const s of shape) out[`${field.name}_${s.suffix}`] = value[s.key] ?? null;
      continue;
    }
    if (!(key in body)) continue;
    out[field.name] = body[key];
  }
  return out;
}
