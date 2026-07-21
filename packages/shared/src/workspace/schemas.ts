import { z } from 'zod';
import { subdomainSchema } from '../auth/schemas.js';

/** Profile fields a member is allowed to edit on their own profile. */
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

/** Workspace-wide messaging/security setting: sync emails between colleagues on the same domain. */
export const updateWorkspaceSecurityRequestSchema = z.object({
  syncInternalEmails: z.boolean(),
});
export type UpdateWorkspaceSecurityRequest = z.infer<typeof updateWorkspaceSecurityRequestSchema>;
