import { z } from 'zod';
import { FieldMetadataType, RelationOnDeleteAction, RelationType } from '../metadata/field-metadata-type.js';
import { fieldMetadataSettingsSchema } from '../metadata/field-metadata-settings.js';

export const createObjectRequestSchema = z.object({
  label: z.string().trim().min(1).max(100),
  labelPlural: z.string().trim().min(1).max(100),
  icon: z.string().trim().min(1).max(50).optional(),
  description: z.string().trim().max(500).nullish(),
});
export type CreateObjectRequest = z.infer<typeof createObjectRequestSchema>;

export const updateObjectRequestSchema = z.object({
  label: z.string().trim().min(1).max(100),
  labelPlural: z.string().trim().min(1).max(100),
  icon: z.string().trim().min(1).max(50),
  description: z.string().trim().max(500).nullish(),
});
export type UpdateObjectRequest = z.infer<typeof updateObjectRequestSchema>;

/** Record label (title) + record image identifier fields — Twenty's object "Options" card. */
export const setObjectIdentifiersRequestSchema = z.object({
  labelIdentifierFieldMetadataId: z.string().uuid().nullable(),
  imageIdentifierFieldMetadataId: z.string().uuid().nullable(),
});
export type SetObjectIdentifiersRequest = z.infer<typeof setObjectIdentifiersRequestSchema>;

export const setActiveRequestSchema = z.object({ isActive: z.boolean() });
export type SetActiveRequest = z.infer<typeof setActiveRequestSchema>;

/** Settings → Layout: hide/show a field on a record's Overview tab. */
export const setFieldRecordPageVisibilityRequestSchema = z.object({ isVisible: z.boolean() });
export type SetFieldRecordPageVisibilityRequest = z.infer<typeof setFieldRecordPageVisibilityRequestSchema>;

/** RELATION/MORPH_RELATION go through the dedicated relation endpoints; ACTOR is system-managed. */
const NON_RELATION_FIELD_TYPES = Object.values(FieldMetadataType).filter(
  (t) =>
    t !== FieldMetadataType.RELATION &&
    t !== FieldMetadataType.MORPH_RELATION &&
    t !== FieldMetadataType.ACTOR,
) as [FieldMetadataType, ...FieldMetadataType[]];
export const nonRelationFieldTypeSchema = z.enum(NON_RELATION_FIELD_TYPES);

export const createFieldRequestSchema = z.object({
  label: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500).nullish(),
  icon: z.string().trim().min(1).max(50).optional(),
  type: nonRelationFieldTypeSchema,
  isNullable: z.boolean().default(true),
  isUnique: z.boolean().default(false),
  settings: fieldMetadataSettingsSchema.optional(),
  defaultValue: z.unknown().optional(),
});
export type CreateFieldRequest = z.infer<typeof createFieldRequestSchema>;

/** Editing a field: label/icon/description plus render config (settings) and default value. Type is immutable. */
export const updateFieldRequestSchema = z.object({
  label: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500).nullish(),
  icon: z.string().trim().min(1).max(50).optional(),
  settings: fieldMetadataSettingsSchema.optional(),
  defaultValue: z.unknown().optional(),
});
export type UpdateFieldRequest = z.infer<typeof updateFieldRequestSchema>;

const relationOnDeleteSchema = z.enum(
  Object.values(RelationOnDeleteAction) as [RelationOnDeleteAction, ...RelationOnDeleteAction[]],
);
const relationTypeSchema = z.enum(
  Object.values(RelationType) as [RelationType, ...RelationType[]],
);

export const createRelationRequestSchema = z.object({
  targetObjectMetadataId: z.string().uuid(),
  /** The relation type from the perspective of the current (source) object. */
  relationType: relationTypeSchema.default(RelationType.MANY_TO_ONE),
  forwardLabel: z.string().trim().min(1).max(100),
  forwardIcon: z.string().trim().min(1).max(50).optional(),
  reverseLabel: z.string().trim().min(1).max(100),
  reverseIcon: z.string().trim().min(1).max(50).optional(),
  onDelete: relationOnDeleteSchema,
  isNullable: z.boolean().default(true),
});
export type CreateRelationRequest = z.infer<typeof createRelationRequestSchema>;

/** Morph (polymorphic) relation: the source "belongs to one of" several targets; each target gets a reverse list. */
export const createMorphRelationRequestSchema = z.object({
  targetObjectMetadataIds: z.array(z.string().uuid()).min(1),
  forwardLabel: z.string().trim().min(1).max(100),
  forwardIcon: z.string().trim().min(1).max(50).optional(),
  reverseLabel: z.string().trim().min(1).max(100),
  reverseIcon: z.string().trim().min(1).max(50).optional(),
  onDelete: relationOnDeleteSchema,
  isNullable: z.boolean().default(true),
});
export type CreateMorphRelationRequest = z.infer<typeof createMorphRelationRequestSchema>;

export const INDEX_TYPES = ['BTREE', 'GIN'] as const;
export const createIndexRequestSchema = z.object({
  fieldMetadataIds: z.array(z.string().uuid()).min(1),
  indexType: z.enum(INDEX_TYPES).default('BTREE'),
  isUnique: z.boolean().default(false),
});
export type CreateIndexRequest = z.infer<typeof createIndexRequestSchema>;
