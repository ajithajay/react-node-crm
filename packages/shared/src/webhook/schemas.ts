import { z } from 'zod';

/** Standard CRUD events a webhook can subscribe to, per object. */
export const WEBHOOK_EVENTS = ['created', 'updated', 'deleted'] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

/**
 * `object.event` pattern, e.g. `company.created`, or `*.*` for everything — each side is either a
 * wildcard or a snake_case identifier (matches object/field `name`s, see metadata/identifier.ts).
 */
const identifierOrWildcard = '(?:\\*|[a-z][a-z0-9]*(?:_[a-z0-9]+)*)';
const operationPattern = new RegExp(`^${identifierOrWildcard}\\.${identifierOrWildcard}$`);

export const createWebhookRequestSchema = z.object({
  targetUrl: z.string().trim().url().max(2000),
  operations: z.array(z.string().trim().regex(operationPattern)).min(1),
  description: z.string().trim().max(500).nullish(),
  /** Optional signing secret — if omitted, the server generates one. */
  secret: z.string().trim().max(200).optional(),
});
export type CreateWebhookRequest = z.infer<typeof createWebhookRequestSchema>;

export const updateWebhookRequestSchema = z.object({
  targetUrl: z.string().trim().url().max(2000),
  operations: z.array(z.string().trim().regex(operationPattern)).min(1),
  description: z.string().trim().max(500).nullish(),
  /** Optional signing secret — omit to leave unchanged, send a value to overwrite it. */
  secret: z.string().trim().max(200).optional(),
});
export type UpdateWebhookRequest = z.infer<typeof updateWebhookRequestSchema>;
