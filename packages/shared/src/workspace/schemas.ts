import { z } from 'zod';
import { subdomainSchema } from '../auth/schemas.js';

export const updateWorkspaceRequestSchema = z.object({
  name: z.string().trim().min(1).max(100),
  subdomain: subdomainSchema,
});
export type UpdateWorkspaceRequest = z.infer<typeof updateWorkspaceRequestSchema>;

export const setDefaultRoleRequestSchema = z.object({
  roleId: z.string().uuid(),
});
export type SetDefaultRoleRequest = z.infer<typeof setDefaultRoleRequestSchema>;
