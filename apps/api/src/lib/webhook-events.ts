import { WebhookEntity } from '@saasly/database';
import { dataSource } from './db.js';
import { enqueueWebhookDelivery } from './queue.js';
import { logger } from './logger.js';

/** Does a webhook subscribed to `operations` match this `object.event`? Supports `*` wildcards. */
function matches(operations: string[], objectName: string, operation: string): boolean {
  const candidates = new Set([`${objectName}.${operation}`, `${objectName}.*`, `*.${operation}`, `*.*`]);
  return operations.some((op) => candidates.has(op));
}

/** Who performed the mutation — mirrors the `createdBy`/`updatedBy` ACTOR stamp already on records. */
export interface WebhookActor {
  userId: string | null;
  workspaceMemberId: string | null;
  name: string;
}

/**
 * Fan out a record mutation to every matching workspace webhook (gap E2). Queries the core webhooks
 * table, then enqueues one `webhook-delivery` job per match — the worker signs + POSTs with retries,
 * so nothing here blocks the request. Best-effort: a dispatch failure never fails the mutation.
 */
export async function dispatchRecordWebhooks(
  workspaceId: string,
  objectName: string,
  operation: 'created' | 'updated' | 'deleted',
  record: Record<string, unknown>,
  actor?: WebhookActor,
  updatedFields?: string[],
): Promise<void> {
  try {
    const webhooks = await dataSource.getRepository(WebhookEntity).findBy({ workspaceId }); // soft-deleted excluded
    const eventName = `${objectName}.${operation}`;
    const timestamp = Date.now();
    const payload = {
      event: eventName,
      objectName,
      operation,
      workspaceId,
      recordId: record.id,
      record,
      actor: actor ?? null,
      ...(updatedFields && updatedFields.length > 0 ? { updatedFields } : {}),
      timestamp,
    };

    await Promise.all(
      webhooks
        .filter((w) => matches(w.operations ?? [], objectName, operation))
        .map((w) =>
          enqueueWebhookDelivery({
            webhookId: w.id,
            targetUrl: w.targetUrl,
            secret: w.secret,
            eventName,
            payload,
            timestamp,
          }),
        ),
    );
  } catch (err) {
    logger.error({ err, workspaceId, objectName, operation }, 'webhook dispatch failed');
  }
}
