import { z } from 'zod';
import { createWorkspaceRequestSchema, selectWorkspaceRequestSchema } from '@saasly/shared';

/**
 * Workspace creation / selection happen before the caller has a workspace-scoped ACCESS token, so
 * identity travels as a WORKSPACE_AGNOSTIC token in the body rather than via the Authorization header.
 */
export const createWorkspaceWithTokenSchema = z.object({ token: z.string().min(1) }).extend(
  createWorkspaceRequestSchema.shape,
);
export type CreateWorkspaceWithTokenRequest = z.infer<typeof createWorkspaceWithTokenSchema>;

export const selectWorkspaceWithTokenSchema = z.object({ token: z.string().min(1) }).extend(
  selectWorkspaceRequestSchema.shape,
);
export type SelectWorkspaceWithTokenRequest = z.infer<typeof selectWorkspaceWithTokenSchema>;
