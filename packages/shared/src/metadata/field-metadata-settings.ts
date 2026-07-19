import { z } from 'zod';

/** The 8 selectable address sub-fields. */
export const ADDRESS_SUB_FIELDS = [
  'street1',
  'street2',
  'city',
  'state',
  'postcode',
  'country',
  'lat',
  'lng',
] as const;
export type AddressSubField = (typeof ADDRESS_SUB_FIELDS)[number];

/** Address sub-fields shown by default (lat/lng hidden). */
export const DEFAULT_VISIBLE_ADDRESS_SUB_FIELDS: AddressSubField[] = [
  'street1',
  'street2',
  'city',
  'state',
  'postcode',
  'country',
];

/** A single SELECT / MULTI_SELECT option. */
export const selectOptionSchema = z.object({
  value: z.string().min(1),
  label: z.string().min(1),
  color: z.string().min(1),
  position: z.number().int().default(0),
});
export type SelectOption = z.infer<typeof selectOptionSchema>;

/**
 * Per-type configuration. Kept as one loose-but-typed union stored as jsonb —
 * new optional keys can be added without a migration.
 */
export const fieldMetadataSettingsSchema = z
  .object({
    // NUMBER
    numberDataType: z.enum(['FLOAT', 'INT', 'BIGINT']).optional(),
    decimals: z.number().int().min(0).max(100).optional(),
    isPercentage: z.boolean().optional(),
    // CURRENCY
    currencyFormat: z.enum(['SHORT', 'FULL']).optional(),
    defaultCurrencyCode: z.string().optional(),
    // DATE / DATE_TIME
    dateDisplayFormat: z.enum(['RELATIVE', 'USER_SETTINGS', 'CUSTOM']).optional(),
    customUnicodeDateFormat: z.string().optional(),
    // TEXT
    displayedMaxRows: z.number().int().min(1).optional(),
    // SELECT / MULTI_SELECT
    options: z.array(selectOptionSchema).optional(),
    // RATING
    maxRating: z.number().int().min(1).max(10).optional(),
    // ADDRESS
    addressSubFields: z.array(z.enum(ADDRESS_SUB_FIELDS)).optional(),
    defaultAddressCountry: z.string().optional(),
    // FILES / EMAILS / LINKS / PHONES / ARRAY
    maxNumberOfValues: z.number().int().min(1).optional(),
    // PHONES
    defaultPhoneCountryCode: z.string().optional(),
    // RELATION / MORPH_RELATION
    relationType: z.enum(['ONE_TO_MANY', 'MANY_TO_ONE']).optional(),
    relationTargetObjectMetadataId: z.string().uuid().optional(),
    relationTargetFieldName: z.string().optional(),
    relationOnDelete: z.enum(['CASCADE', 'RESTRICT', 'SET_NULL', 'NO_ACTION']).optional(),
    morphTargetObjectMetadataIds: z.array(z.string().uuid()).optional(),
    /** True on the ONE_TO_MANY reverse side of a MORPH_RELATION (many junction rows point back here). */
    isMorphReverse: z.boolean().optional(),
  })
  .partial()
  .passthrough();

export type FieldMetadataSettings = z.infer<typeof fieldMetadataSettingsSchema>;
