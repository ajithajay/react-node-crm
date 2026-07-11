import { z } from 'zod';
import { ViewFilterOperand, ViewSortDirection, ViewType } from '../metadata/view-type.js';

const typeValues = Object.values(ViewType) as [string, ...string[]];
const operandValues = Object.values(ViewFilterOperand) as [string, ...string[]];
const directionValues = Object.values(ViewSortDirection) as [string, ...string[]];

export const listViewsQuerySchema = z.object({
  objectMetadataId: z.string().uuid(),
});
export type ListViewsQuery = z.infer<typeof listViewsQuerySchema>;

export const createViewRequestSchema = z.object({
  objectMetadataId: z.string().uuid(),
  name: z.string().trim().min(1).max(100),
  type: z.enum(typeValues).default('TABLE'),
  icon: z.string().trim().min(1).max(50).optional(),
});
export type CreateViewRequest = z.infer<typeof createViewRequestSchema>;

/**
 * `kanbanFieldMetadataId` doubles as the generic "group by" field for both view types — required in
 * practice for KANBAN (it defines the swim lanes), optional for TABLE (enables row grouping).
 */
export const updateViewRequestSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  icon: z.string().trim().min(1).max(50).nullish(),
  isCompact: z.boolean().optional(),
  kanbanFieldMetadataId: z.string().uuid().nullish(),
  position: z.number().int().min(0).optional(),
});
export type UpdateViewRequest = z.infer<typeof updateViewRequestSchema>;

export const viewFieldInputSchema = z.object({
  fieldMetadataId: z.string().uuid(),
  isVisible: z.boolean().default(true),
  size: z.number().int().min(50).max(1000).default(150),
});
export const setViewFieldsRequestSchema = z.array(viewFieldInputSchema);
export type SetViewFieldsRequest = z.infer<typeof setViewFieldsRequestSchema>;

/**
 * Flat AND-of-conditions, same v1 scope as the record-list query parser (see record/schemas.ts) —
 * nested AND/OR groups need new modeling on top of `ViewFilterEntity`'s flat shape; deferred.
 */
export const viewFilterInputSchema = z.object({
  fieldMetadataId: z.string().uuid(),
  operand: z.enum(operandValues),
  value: z.unknown().optional(),
});
export const setViewFiltersRequestSchema = z.array(viewFilterInputSchema);
export type SetViewFiltersRequest = z.infer<typeof setViewFiltersRequestSchema>;

export const viewSortInputSchema = z.object({
  fieldMetadataId: z.string().uuid(),
  direction: z.enum(directionValues).default('ASC'),
});
export const setViewSortsRequestSchema = z.array(viewSortInputSchema);
export type SetViewSortsRequest = z.infer<typeof setViewSortsRequestSchema>;

/** Per-group-value UI state (collapsed/order) for a grouped table or kanban column. */
export const viewGroupInputSchema = z.object({
  fieldValue: z.string(),
  isVisible: z.boolean().default(true),
});
export const setViewGroupsRequestSchema = z.array(viewGroupInputSchema);
export type SetViewGroupsRequest = z.infer<typeof setViewGroupsRequestSchema>;
