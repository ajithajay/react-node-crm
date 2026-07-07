import { z } from 'zod';

/** Plain `YYYY-MM-DD` — kept as a string (no `z.coerce`) so input/output types match for react-hook-form. */
const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date');

export const createApiKeyRequestSchema = z.object({
  name: z.string().trim().min(1).max(100),
  roleId: z.string().uuid().nullish(),
  expiresAt: dateOnlySchema.nullish(),
});
export type CreateApiKeyRequest = z.infer<typeof createApiKeyRequestSchema>;
