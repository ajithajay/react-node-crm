import { z } from 'zod';

/** A single SELECT / MULTI_SELECT option. */
export const selectOptionSchema = z.object({
  value: z.string().min(1),
  label: z.string().min(1),
  color: z.string().min(1),
  position: z.number().int().default(0),
});
export type SelectOption = z.infer<typeof selectOptionSchema>;

/**
 * Per-type configuration (BRD §5.2). Kept as one loose-but-typed union stored as jsonb —
 * new optional keys can be added without a migration.
 */
export const fieldMetadataSettingsSchema = z
  .object({
    // NUMBER
    numberDataType: z.enum(['FLOAT', 'INT', 'BIGINT']).optional(),
    decimals: z.number().int().min(0).max(10).optional(),
    isPercentage: z.boolean().optional(),
    // CURRENCY
    currencyFormat: z.enum(['SHORT', 'FULL']).optional(),
    // DATE / DATE_TIME
    dateDisplayFormat: z.enum(['RELATIVE', 'USER_SETTINGS', 'CUSTOM']).optional(),
    // TEXT
    displayedMaxRows: z.number().int().min(1).optional(),
    // SELECT / MULTI_SELECT
    options: z.array(selectOptionSchema).optional(),
    // RATING
    maxRating: z.number().int().min(1).max(10).optional(),
    // ADDRESS
    addressSubFields: z.array(z.string()).optional(),
    // FILES
    maxNumberOfValues: z.number().int().min(1).optional(),
    // RELATION / MORPH_RELATION
    relationType: z.enum(['ONE_TO_MANY', 'MANY_TO_ONE']).optional(),
    relationTargetObjectMetadataId: z.string().uuid().optional(),
    relationTargetFieldName: z.string().optional(),
    relationOnDelete: z.enum(['CASCADE', 'RESTRICT', 'SET_NULL', 'NO_ACTION']).optional(),
    morphTargetObjectMetadataIds: z.array(z.string().uuid()).optional(),
  })
  .partial()
  .passthrough();

export type FieldMetadataSettings = z.infer<typeof fieldMetadataSettingsSchema>;
