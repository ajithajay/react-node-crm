import { z } from 'zod';
import { emailSchema, passwordSchema } from '../auth/schemas.js';

export const createInvitationRequestSchema = z.object({
  email: emailSchema,
  /** Role the invitee joins with. Omitted (or null) falls back to the workspace's default role. */
  roleId: z.string().uuid().nullish(),
});
export type CreateInvitationRequest = z.infer<typeof createInvitationRequestSchema>;

export const acceptInvitationRequestSchema = z.object({
  password: passwordSchema,
});
export type AcceptInvitationRequest = z.infer<typeof acceptInvitationRequestSchema>;
