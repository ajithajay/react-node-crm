import { z } from 'zod';
import { subdomainSchema } from '../auth/schemas.js';

/** Profile fields a member is allowed to edit on their own profile (Twenty's Editable Profile Fields). */
export const EDITABLE_PROFILE_FIELDS = ['firstName', 'lastName', 'profilePicture'] as const;
export type EditableProfileField = (typeof EDITABLE_PROFILE_FIELDS)[number];
export const editableProfileFieldsSchema = z.array(z.enum(EDITABLE_PROFILE_FIELDS));

export const updateWorkspaceRequestSchema = z.object({
  name: z.string().trim().min(1).max(100),
  subdomain: subdomainSchema,
  editableProfileFields: editableProfileFieldsSchema.optional(),
});
export type UpdateWorkspaceRequest = z.infer<typeof updateWorkspaceRequestSchema>;

export const setDefaultRoleRequestSchema = z.object({
  roleId: z.string().uuid(),
});
export type SetDefaultRoleRequest = z.infer<typeof setDefaultRoleRequestSchema>;
