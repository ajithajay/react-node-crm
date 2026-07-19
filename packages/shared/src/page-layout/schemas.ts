import { z } from 'zod';

/** Widget types on a record page (reduced to our built surfaces). FIELDS renders a
 * group of the object's fields; FIELD renders a single field with a chosen display mode; the rest
 * render the record's activity relations and carry no config. */
export const PAGE_LAYOUT_WIDGET_TYPES = ['FIELDS', 'FIELD', 'TIMELINE', 'NOTES', 'TASKS', 'FILES'] as const;
export type PageLayoutWidgetType = (typeof PAGE_LAYOUT_WIDGET_TYPES)[number];

/** How a single FIELD widget renders its value — Field / Card / Table, plus our
 * DOCUMENT mode (a Task/Note's rich-text body as a full-width, always-editable document). */
export const FIELD_DISPLAY_MODES = ['PLAIN', 'CARD', 'TABLE', 'DOCUMENT'] as const;
export type FieldDisplayMode = (typeof FIELD_DISPLAY_MODES)[number];

/** Polymorphic per-widget-type settings, stored as the widget's `configuration` jsonb. */
export const pageLayoutWidgetConfigurationSchema = z
  .object({
    // FIELDS widget configuration
    showMoreFieldsButton: z.boolean().optional(),
    autoVisibleNewFields: z.boolean().optional(),
    // FIELD widget configuration
    fieldMetadataId: z.string().uuid().optional(),
    displayMode: z.enum(FIELD_DISPLAY_MODES).optional(),
  })
  .partial()
  .passthrough();
export type PageLayoutWidgetConfiguration = z.infer<typeof pageLayoutWidgetConfigurationSchema>;

// ---- Save request (nested replace of tabs and widgets) ----

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
  configuration: pageLayoutWidgetConfigurationSchema.optional(),
  /** FIELDS widgets only. */
  groups: z.array(pageLayoutGroupSchema).optional(),
});

export const pageLayoutTabSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(100),
  icon: z.string().trim().max(50).nullish(),
  isVisible: z.boolean().default(true),
  /** The layout's default-to-focus tab ("pin tab"). Only one tab should carry this. */
  isPinned: z.boolean().default(false),
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
  configuration: PageLayoutWidgetConfiguration;
  /** Populated for FIELDS widgets; empty otherwise. */
  groups: PageLayoutGroupDto[];
}

export interface PageLayoutTabDto {
  id: string;
  title: string;
  icon: string | null;
  position: number;
  isVisible: boolean;
  isPinned: boolean;
  widgets: PageLayoutWidgetDto[];
}

export interface PageLayoutDto {
  id: string;
  objectMetadataId: string;
  type: string;
  name: string;
  tabs: PageLayoutTabDto[];
}
