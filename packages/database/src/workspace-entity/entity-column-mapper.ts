import type { EntitySchemaColumnOptions } from 'typeorm';
import { FieldMetadataType } from '@saasly/shared';
import type { FieldMetadataEntity } from '../entities/field-metadata.entity.js';

/**
 * Field type → TypeORM EntitySchema column(s), for the dynamic per-workspace entities.
 * Column *names* here MUST match `mapFieldToColumns` (ddl/field-column-mapper.ts) exactly —
 * that function creates the physical columns, this one describes them to the ORM.
 */
export function mapFieldToEntityColumns(
  field: Pick<FieldMetadataEntity, 'name' | 'type' | 'isNullable' | 'isUnique' | 'settings'>,
  tableName: string,
): Record<string, EntitySchemaColumnOptions> {
  const { name, isNullable: nullable, isUnique: unique, settings } = field;
  const withSuffix = (suffix: string) => (suffix ? `${name}_${suffix}` : name);
  const col = (suffix: string, options: EntitySchemaColumnOptions) => ({
    [withSuffix(suffix)]: { nullable: true, ...options },
  });

  switch (field.type) {
    case FieldMetadataType.TEXT:
      return col('', { type: 'text', nullable, unique });

    case FieldMetadataType.NUMBER: {
      const dataType = settings?.numberDataType ?? 'FLOAT';
      const type = dataType === 'INT' ? 'integer' : dataType === 'BIGINT' ? 'bigint' : 'numeric';
      return col('', { type, nullable, unique });
    }

    case FieldMetadataType.BOOLEAN:
      return col('', { type: 'boolean', nullable });

    case FieldMetadataType.DATE_TIME:
      return col('', { type: 'timestamptz', nullable });

    case FieldMetadataType.DATE:
      return col('', { type: 'date', nullable });

    case FieldMetadataType.SELECT: {
      const values = (settings?.options ?? []).map((o) => o.value);
      return col('', {
        type: 'enum',
        enum: values.length > 0 ? values : undefined,
        enumName: `${tableName}_${name}_enum`,
        nullable,
      });
    }

    case FieldMetadataType.MULTI_SELECT:
      return col('', { type: 'text', array: true, nullable: true });

    case FieldMetadataType.RATING:
      return col('', { type: 'integer', nullable });

    case FieldMetadataType.FILES:
      return col('', { type: 'jsonb', nullable: true });

    case FieldMetadataType.CURRENCY:
      return {
        ...col('amount_micros', { type: 'bigint', nullable, unique }),
        ...col('currency_code', { type: 'text', nullable: true }),
      };

    case FieldMetadataType.EMAILS:
      return {
        ...col('primary_email', { type: 'text', nullable, unique }),
        ...col('additional_emails', { type: 'jsonb', nullable: true }),
      };

    case FieldMetadataType.LINKS:
      return {
        ...col('primary_link_url', { type: 'text', nullable, unique }),
        ...col('primary_link_label', { type: 'text', nullable: true }),
        ...col('secondary_links', { type: 'jsonb', nullable: true }),
      };

    case FieldMetadataType.PHONES:
      return {
        ...col('primary_phone_calling_code', { type: 'text', nullable: true }),
        ...col('primary_phone_country_code', { type: 'text', nullable: true }),
        ...col('primary_phone_number', { type: 'text', nullable, unique }),
        ...col('additional_phones', { type: 'jsonb', nullable: true }),
      };

    case FieldMetadataType.FULL_NAME:
      return {
        ...col('first_name', { type: 'text', nullable }),
        ...col('last_name', { type: 'text', nullable }),
      };

    case FieldMetadataType.ADDRESS:
      return {
        ...col('street1', { type: 'text', nullable: true }),
        ...col('street2', { type: 'text', nullable: true }),
        ...col('city', { type: 'text', nullable: true }),
        ...col('state', { type: 'text', nullable: true }),
        ...col('country', { type: 'text', nullable: true }),
        ...col('postcode', { type: 'text', nullable: true }),
        ...col('lat', { type: 'numeric', nullable: true }),
        ...col('lng', { type: 'numeric', nullable: true }),
      };

    case FieldMetadataType.RICH_TEXT:
      return {
        ...col('blocknote', { type: 'jsonb', nullable: true }),
        ...col('markdown', { type: 'text', nullable: true }),
      };

    case FieldMetadataType.ACTOR:
      return {
        ...col('source', { type: 'text', nullable: true }),
        ...col('workspace_member_id', { type: 'uuid', nullable: true }),
        ...col('name', { type: 'text', nullable: true }),
        ...col('context', { type: 'jsonb', nullable: true }),
      };

    case FieldMetadataType.RAW_JSON:
      return col('', { type: 'jsonb', nullable: true });

    case FieldMetadataType.ARRAY:
      return col('', { type: 'jsonb', nullable: true });

    case FieldMetadataType.UUID:
      return col('', { type: 'uuid', nullable, unique });

    case FieldMetadataType.RELATION:
      // Only the MANY_TO_ONE side owns a physical `<name>_id` column. The ONE_TO_MANY reverse side
      // is virtual (no column) — emit nothing so the dynamic entity doesn't reference a missing column.
      return settings?.relationType === 'ONE_TO_MANY' ? {} : col('id', { type: 'uuid', nullable });

    case FieldMetadataType.MORPH_RELATION:
      return {
        ...col('target_type', { type: 'text', nullable }),
        ...col('target_id', { type: 'uuid', nullable }),
      };

    default: {
      const exhaustive: never = field.type;
      throw new Error(`Unhandled field type: ${exhaustive}`);
    }
  }
}
