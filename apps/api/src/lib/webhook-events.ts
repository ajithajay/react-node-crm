import { WebhookEntity } from '@saasly/database';
import { dataSource } from './db.js';
import { enqueueWebhookDelivery } from './queue.js';
import { logger } from './logger.js';

/** Does a webhook subscribed to `operations` match this `object.event`? Supports `*` wildcards. */
function matches(operations: string[], objectName: string, operation: string): boolean {
  const candidates = new Set([`${objectName}.${operation}`, `${objectName}.*`, `*.${operation}`, `*.*`]);
  return operations.some((op) => candidates.has(op));
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
): Promise<void> {
  try {
    const webhooks = await dataSource.getRepository(WebhookEntity).findBy({ workspaceId }); // soft-deleted excluded
    const eventName = `${objectName}.${operation}`;
    const timestamp = Date.now();
    const payload = { event: eventName, objectName, operation, recordId: record.id, record, timestamp };

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
