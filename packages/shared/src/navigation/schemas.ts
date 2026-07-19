import { z } from 'zod';

export const NAVIGATION_MENU_ITEM_TYPES = ['FOLDER', 'OBJECT', 'VIEW', 'LINK'] as const;
export type NavigationMenuItemType = (typeof NAVIGATION_MENU_ITEM_TYPES)[number];

/**
 * A LINK item's `link` is either an absolute http(s) URL (external, opens in a new tab) or an
 * app-relative path starting with `/` (internal, rendered as a client-side route). Rejects
 * `javascript:`/`data:` and other schemes that would execute unsanitized as an anchor href.
 */
const navigationLinkSchema = z
  .string()
  .refine((value) => /^https?:\/\//i.test(value) || /^\/[\w/-]*$/.test(value), {
    message: 'Link must be an http(s) URL or an app-relative path starting with /',
  });

export const createNavigationMenuItemSchema = z.object({
  type: z.enum(NAVIGATION_MENU_ITEM_TYPES),
  label: z.string().trim().min(1).max(100),
  icon: z.string().trim().min(1).max(50).nullish(),
  color: z.string().trim().min(1).max(30).nullish(),
  folderId: z.string().uuid().nullish(),
  targetObjectMetadataId: z.string().uuid().nullish(),
  viewId: z.string().uuid().nullish(),
  link: navigationLinkSchema.nullish(),
});
export type CreateNavigationMenuItemRequest = z.infer<typeof createNavigationMenuItemSchema>;

export const updateNavigationMenuItemSchema = z.object({
  label: z.string().trim().min(1).max(100).optional(),
  icon: z.string().trim().min(1).max(50).nullish(),
  color: z.string().trim().min(1).max(30).nullish(),
  folderId: z.string().uuid().nullish(),
  position: z.number().optional(),
});
export type UpdateNavigationMenuItemRequest = z.infer<typeof updateNavigationMenuItemSchema>;
