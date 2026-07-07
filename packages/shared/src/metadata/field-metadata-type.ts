/**
 * All field types selectable in the data-model builder (BRD §5.1 — all types are v1).
 * Grouped as the UI groups them: Basic (simple), Basic (composite), Relation, Advanced.
 */
export const FieldMetadataType = {
  // Basic — simple
  TEXT: 'TEXT',
  NUMBER: 'NUMBER',
  BOOLEAN: 'BOOLEAN',
  DATE_TIME: 'DATE_TIME',
  DATE: 'DATE',
  SELECT: 'SELECT',
  MULTI_SELECT: 'MULTI_SELECT',
  RATING: 'RATING',
  FILES: 'FILES',
  // Basic — composite (multiple underlying columns)
  CURRENCY: 'CURRENCY',
  EMAILS: 'EMAILS',
  LINKS: 'LINKS',
  PHONES: 'PHONES',
  FULL_NAME: 'FULL_NAME',
  ADDRESS: 'ADDRESS',
  RICH_TEXT: 'RICH_TEXT',
  ACTOR: 'ACTOR',
  // Relation
  RELATION: 'RELATION',
  MORPH_RELATION: 'MORPH_RELATION',
  // Advanced
  RAW_JSON: 'RAW_JSON',
  ARRAY: 'ARRAY',
  UUID: 'UUID',
} as const;

export type FieldMetadataType = (typeof FieldMetadataType)[keyof typeof FieldMetadataType];

export const COMPOSITE_FIELD_TYPES: ReadonlySet<FieldMetadataType> = new Set([
  FieldMetadataType.CURRENCY,
  FieldMetadataType.EMAILS,
  FieldMetadataType.LINKS,
  FieldMetadataType.PHONES,
  FieldMetadataType.FULL_NAME,
  FieldMetadataType.ADDRESS,
  FieldMetadataType.RICH_TEXT,
  FieldMetadataType.ACTOR,
]);

/**
 * Field types that are system-managed only: never user-selectable in the "add field" picker,
 * and (for ACTOR) only ever created as the created_by/updated_by audit fields.
 */
export const SYSTEM_ONLY_FIELD_TYPES: ReadonlySet<FieldMetadataType> = new Set([
  FieldMetadataType.ACTOR,
]);

/** Field types eligible to be an object's record-label (title) identifier. */
export const LABEL_IDENTIFIER_FIELD_TYPES: ReadonlySet<FieldMetadataType> = new Set([
  FieldMetadataType.TEXT,
  FieldMetadataType.FULL_NAME,
]);

export const RelationType = {
  ONE_TO_MANY: 'ONE_TO_MANY',
  MANY_TO_ONE: 'MANY_TO_ONE',
} as const;
export type RelationType = (typeof RelationType)[keyof typeof RelationType];

export const RelationOnDeleteAction = {
  CASCADE: 'CASCADE',
  RESTRICT: 'RESTRICT',
  SET_NULL: 'SET_NULL',
  NO_ACTION: 'NO_ACTION',
} as const;
export type RelationOnDeleteAction =
  (typeof RelationOnDeleteAction)[keyof typeof RelationOnDeleteAction];
