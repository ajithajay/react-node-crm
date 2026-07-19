import { randomBytes } from 'node:crypto';
import { WebhookEntity } from '@saasly/database';
import type { CreateWebhookRequest, UpdateWebhookRequest } from '@saasly/shared';
import { dataSource } from '../../lib/db.js';
import { NotFoundError } from '../../lib/errors.js';
import { record } from '../audit-log/audit-log.service.js';

const webhookRepo = () => dataSource.getRepository(WebhookEntity);

function generateSecret(): string {
  return randomBytes(24).toString('hex');
}

export interface WebhookSummary {
  id: string;
  targetUrl: string;
  operations: string[];
  secret: string | null;
  description: string | null;
  createdAt: Date;
}

function toSummary(webhook: WebhookEntity): WebhookSummary {
  return {
    id: webhook.id,
    targetUrl: webhook.targetUrl,
    operations: webhook.operations,
    secret: webhook.secret,
    description: webhook.description,
    createdAt: webhook.createdAt,
  };
}

export async function listWebhooks(workspaceId: string): Promise<WebhookSummary[]> {
  const webhooks = await webhookRepo().findBy({ workspaceId });
  return webhooks.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).map(toSummary);
}

export async function createWebhook(
  workspaceId: string,
  actorUserId: string,
  input: CreateWebhookRequest,
): Promise<WebhookSummary> {
  const webhook = await webhookRepo().save(
    webhookRepo().create({
      workspaceId,
      targetUrl: input.targetUrl,
      operations: input.operations,
      secret: input.secret || generateSecret(),
      description: input.description ?? null,
    }),
  );

  await record(workspaceId, actorUserId, 'webhook.created', { targetUrl: webhook.targetUrl });
  return toSummary(webhook);
}

export async function updateWebhook(
  workspaceId: string,
  webhookId: string,
  actorUserId: string,
  input: UpdateWebhookRequest,
): Promise<WebhookSummary> {
  const webhook = await webhookRepo().findOneBy({ id: webhookId, workspaceId });
  if (!webhook) throw new NotFoundError('Webhook not found');

  webhook.targetUrl = input.targetUrl;
  webhook.operations = input.operations;
  webhook.description = input.description ?? null;
  if (input.secret !== undefined) webhook.secret = input.secret || null;
  await webhookRepo().save(webhook);

  await record(workspaceId, actorUserId, 'webhook.updated', { targetUrl: webhook.targetUrl });
  return toSummary(webhook);
}

/**
 * The secret is used to HMAC-SHA256-sign delivered payloads (an `X-Webhook-Signature` header) so the
 * receiver can verify authenticity. Regenerating invalidates the old value immediately since it isn't
 * hashed (it's a shared signing secret the operator copies into their receiver, not a login credential).
 */
export async function regenerateWebhookSecret(
  workspaceId: string,
  webhookId: string,
  actorUserId: string,
): Promise<WebhookSummary> {
  const webhook = await webhookRepo().findOneBy({ id: webhookId, workspaceId });
  if (!webhook) throw new NotFoundError('Webhook not found');

  webhook.secret = generateSecret();
  await webhookRepo().save(webhook);

  await record(workspaceId, actorUserId, 'webhook.secret_regenerated', { targetUrl: webhook.targetUrl });
  return toSummary(webhook);
}

export async function deleteWebhook(workspaceId: string, webhookId: string, actorUserId: string): Promise<void> {
  const webhook = await webhookRepo().findOneBy({ id: webhookId, workspaceId });
  if (!webhook) throw new NotFoundError('Webhook not found');

  await webhookRepo().softRemove(webhook);
  await record(workspaceId, actorUserId, 'webhook.deleted', { targetUrl: webhook.targetUrl });
}
