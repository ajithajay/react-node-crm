import { createHmac } from 'node:crypto';
import { Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { QueueName, type WebhookDeliveryJobData } from '@saasly/shared';
import { env } from '../../lib/config.js';
import { logger } from '../../lib/logger.js';

const DELIVERY_TIMEOUT_MS = 8000;
/** Allow private/loopback targets only when explicitly enabled (local testing); blocked by default (SSRF). */
const ALLOW_PRIVATE_TARGETS = process.env.WEBHOOK_ALLOW_PRIVATE_TARGETS === 'true';

/** Basic SSRF guard: reject loopback / link-local / private-range hosts unless explicitly allowed. */
function isBlockedHost(hostname: string): boolean {
  if (ALLOW_PRIVATE_TARGETS) return false;
  const host = hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) return true;
  if (host === '::1' || host.startsWith('fc') || host.startsWith('fd')) return true;
  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.\d{1,3}$/.exec(host);
  if (ipv4) {
    const [, a, b] = ipv4.map(Number) as [number, number, number, number];
    if (a === 10 || a === 127 || (a === 169 && b === 254) || (a === 192 && b === 168)) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
  }
  return false;
}

async function deliver(data: WebhookDeliveryJobData): Promise<void> {
  const url = new URL(data.targetUrl);
  if (isBlockedHost(url.hostname)) {
    // A permanent failure — don't burn retries on a target we'll never allow.
    logger.warn({ webhookId: data.webhookId, host: url.hostname }, 'webhook target blocked (SSRF guard)');
    return;
  }

  const body = JSON.stringify(data.payload);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Webhook-Id': data.webhookId,
    'X-Webhook-Event': data.eventName,
    'X-Webhook-Timestamp': String(data.timestamp),
  };
  if (data.secret) {
    headers['X-Webhook-Signature'] = createHmac('sha256', data.secret).update(`${data.timestamp}:${body}`).digest('hex');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS);
  try {
    const res = await fetch(data.targetUrl, { method: 'POST', headers, body, signal: controller.signal });
    if (!res.ok) throw new Error(`webhook target responded ${res.status}`); // non-2xx → BullMQ retry
    logger.info({ webhookId: data.webhookId, event: data.eventName, status: res.status }, 'webhook delivered');
  } finally {
    clearTimeout(timer);
  }
}

export function startWebhookWorker(): Worker<WebhookDeliveryJobData> {
  const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
  const worker = new Worker<WebhookDeliveryJobData>(QueueName.WEBHOOK_DELIVERY, (job) => deliver(job.data), {
    connection,
  });
  worker.on('error', (err) => logger.error({ err }, '[worker:webhook] error'));
  worker.on('failed', (job, err) =>
    logger.warn({ jobId: job?.id, attempts: job?.attemptsMade, err: err.message }, '[worker:webhook] delivery failed'),
  );
  return worker;
}
