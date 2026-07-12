import { z } from 'zod';

/** Widget types on a record page (Twenty parity, reduced to our built surfaces). FIELDS renders the
 * object's field groups; the rest render the record's activity relations and carry no config. */
export const PAGE_LAYOUT_WIDGET_TYPES = ['FIELDS', 'TIMELINE', 'NOTES', 'TASKS', 'FILES'] as const;
export type PageLayoutWidgetType = (typeof PAGE_LAYOUT_WIDGET_TYPES)[number];

// ---- Save request (nested replace, mirroring Twenty's updatePageLayoutWithTabsAndWidgets) ----

/** A field inside a FIELDS-widget group. `isVisible` writes `field_metadata.is_visible_in_record_page`. */
export const pageLayoutFieldSchema = z.object({
  fieldMetadataId: z.string().uuid(),
  isVisible: z.boolean(),
});

export const pageLayoutGroupSchema = z.object({
  /** Omitted for a newly-created group. */
  id: z.string().uuid().optional(),
  label: z.string().trim().min(1).max(100),
  isVisible: z.boolean().default(true),
  /** Fields in render order. */
  fields: z.array(pageLayoutFieldSchema),
});

export const pageLayoutWidgetSchema = z.object({
  id: z.string().uuid().optional(),
  type: z.enum(PAGE_LAYOUT_WIDGET_TYPES),
  title: z.string().trim().min(1).max(100),
  isVisible: z.boolean().default(true),
  /** FIELDS widgets only. */
  groups: z.array(pageLayoutGroupSchema).optional(),
});

export const pageLayoutTabSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(100),
  icon: z.string().trim().max(50).nullish(),
  isVisible: z.boolean().default(true),
  widgets: z.array(pageLayoutWidgetSchema),
});

/** Bulk-replace an object's record-page layout — tabs/widgets/groups in array order = position. */
export const savePageLayoutRequestSchema = z.object({
  tabs: z.array(pageLayoutTabSchema),
});
export type SavePageLayoutRequest = z.infer<typeof savePageLayoutRequestSchema>;

// ---- Response DTOs (GET /page-layout) ----

export interface PageLayoutFieldDto {
  fieldMetadataId: string;
  isVisible: boolean;
  label: string;
  icon: string | null;
  fieldType: string;
}

export interface PageLayoutGroupDto {
  id: string;
  label: string;
  isVisible: boolean;
  position: number;
  fields: PageLayoutFieldDto[];
}

export interface PageLayoutWidgetDto {
  id: string;
  type: PageLayoutWidgetType;
  title: string;
  position: number;
  isVisible: boolean;
  /** Populated for FIELDS widgets; empty otherwise. */
  groups: PageLayoutGroupDto[];
}

export interface PageLayoutTabDto {
  id: string;
  title: string;
  icon: string | null;
  position: number;
  isVisible: boolean;
  widgets: PageLayoutWidgetDto[];
}

export interface PageLayoutDto {
  id: string;
  objectMetadataId: string;
  type: string;
  name: string;
  tabs: PageLayoutTabDto[];
}
