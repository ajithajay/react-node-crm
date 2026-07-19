import {
  FieldMetadataType,
  type FieldMetadataSettings,
  type FieldMetadataType as FieldMetadataTypeT,
} from '@saasly/shared';
import { quoteIdent } from './identifier.util.js';

export interface FieldColumnDefinition {
  name: string;
  sqlType: string;
  isNullable: boolean;
  isUnique?: boolean;
}

export interface MappedField {
  columns: FieldColumnDefinition[];
  /** Present only for SELECT — the enum type to create before the column. */
  enumType?: { name: string; values: string[] };
}

export interface FieldMetadataLike {
  name: string;
  type: FieldMetadataTypeT;
  isNullable: boolean;
  isUnique: boolean;
  settings: FieldMetadataSettings | null;
}

/**
 * Field type → Postgres column(s). Composite types produce
 * multiple columns; SELECT additionally requires an enum type created first (see `enumType`).
 * Unique/nullable apply to the field's primary column only (composite sub-columns are never unique).
 */
export function mapFieldToColumns(
  field: FieldMetadataLike,
  schemaName: string,
  tableName: string,
): MappedField {
  const { name, isNullable, isUnique, settings } = field;
  const col = (
    suffix: string,
    sqlType: string,
    opts: { nullable?: boolean; unique?: boolean } = {},
  ): FieldColumnDefinition => ({
    name: suffix ? `${name}_${suffix}` : name,
    sqlType,
    isNullable: opts.nullable ?? true,
    isUnique: opts.unique,
  });

  switch (field.type) {
    case FieldMetadataType.TEXT:
      return { columns: [col('', 'text', { nullable: isNullable, unique: isUnique })] };

    case FieldMetadataType.NUMBER: {
      const dataType = settings?.numberDataType ?? 'FLOAT';
      const sqlType = dataType === 'INT' ? 'integer' : dataType === 'BIGINT' ? 'bigint' : 'numeric';
      return { columns: [col('', sqlType, { nullable: isNullable, unique: isUnique })] };
    }

    case FieldMetadataType.BOOLEAN:
      return { columns: [col('', 'boolean', { nullable: isNullable })] };

    case FieldMetadataType.DATE_TIME:
      return { columns: [col('', 'timestamptz', { nullable: isNullable })] };

    case FieldMetadataType.DATE:
      return { columns: [col('', 'date', { nullable: isNullable })] };

    case FieldMetadataType.SELECT: {
      const enumName = `${tableName}_${name}_enum`;
      const values = (settings?.options ?? []).map((o) => o.value);
      return {
        columns: [
          col('', `${quoteIdent(schemaName)}.${quoteIdent(enumName)}`, { nullable: isNullable }),
        ],
        enumType: { name: enumName, values },
      };
    }

    case FieldMetadataType.MULTI_SELECT:
      return { columns: [col('', 'text[]', { nullable: true })] };

    case FieldMetadataType.RATING:
      return { columns: [col('', 'integer', { nullable: isNullable })] };

    case FieldMetadataType.FILES:
      return { columns: [col('', 'jsonb', { nullable: true })] };

    case FieldMetadataType.CURRENCY:
      return {
        columns: [
          col('amount_micros', 'bigint', { nullable: isNullable, unique: isUnique }),
          col('currency_code', 'text', { nullable: true }),
        ],
      };

    case FieldMetadataType.EMAILS:
      return {
        columns: [
          col('primary_email', 'text', { nullable: isNullable, unique: isUnique }),
          col('additional_emails', 'jsonb', { nullable: true }),
        ],
      };

    case FieldMetadataType.LINKS:
      return {
        columns: [
          col('primary_link_url', 'text', { nullable: isNullable, unique: isUnique }),
          col('primary_link_label', 'text', { nullable: true }),
          col('secondary_links', 'jsonb', { nullable: true }),
        ],
      };

    case FieldMetadataType.PHONES:
      return {
        columns: [
          col('primary_phone_calling_code', 'text', { nullable: true }),
          col('primary_phone_country_code', 'text', { nullable: true }),
          col('primary_phone_number', 'text', { nullable: isNullable, unique: isUnique }),
          col('additional_phones', 'jsonb', { nullable: true }),
        ],
      };

    case FieldMetadataType.FULL_NAME:
      return {
        columns: [
          col('first_name', 'text', { nullable: isNullable }),
          col('last_name', 'text', { nullable: isNullable }),
        ],
      };

    case FieldMetadataType.ADDRESS:
      return {
        columns: [
          col('street1', 'text', { nullable: true }),
          col('street2', 'text', { nullable: true }),
          col('city', 'text', { nullable: true }),
          col('state', 'text', { nullable: true }),
          col('country', 'text', { nullable: true }),
          col('postcode', 'text', { nullable: true }),
          col('lat', 'numeric', { nullable: true }),
          col('lng', 'numeric', { nullable: true }),
        ],
      };

    case FieldMetadataType.RICH_TEXT:
      return {
        columns: [
          col('blocknote', 'jsonb', { nullable: true }),
          col('markdown', 'text', { nullable: true }),
        ],
      };

    case FieldMetadataType.ACTOR:
      return {
        columns: [
          col('source', 'text', { nullable: true }),
          col('workspace_member_id', 'uuid', { nullable: true }),
          col('name', 'text', { nullable: true }),
          col('context', 'jsonb', { nullable: true }),
        ],
      };

    case FieldMetadataType.RAW_JSON:
      return { columns: [col('', 'jsonb', { nullable: true })] };

    case FieldMetadataType.ARRAY:
      return { columns: [col('', 'jsonb', { nullable: true })] };

    case FieldMetadataType.UUID:
      return { columns: [col('', 'uuid', { nullable: isNullable, unique: isUnique })] };

    case FieldMetadataType.RELATION:
      // FK constraint (target table/column) is added separately by the metadata engine,
      // which resolves the target object's table name from core metadata.
      return { columns: [col('id', 'uuid', { nullable: isNullable })] };

    case FieldMetadataType.MORPH_RELATION:
      return {
        columns: [
          col('target_type', 'text', { nullable: isNullable }),
          col('target_id', 'uuid', { nullable: isNullable }),
        ],
      };

    default: {
      const exhaustive: never = field.type;
      throw new Error(`Unhandled field type: ${exhaustive}`);
    }
  }
}
