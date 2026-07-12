import { logger } from './lib/logger.js';
import { startEmailWorker } from './modules/email/email.processor.js';
import { startWebhookWorker } from './modules/webhook/webhook.processor.js';

async function main(): Promise<void> {
  const emailWorker = startEmailWorker();
  const webhookWorker = startWebhookWorker();
  await Promise.all([emailWorker.waitUntilReady(), webhookWorker.waitUntilReady()]);
  logger.info('[worker] ready — connected to Redis, listening on queues: email, webhook-delivery');
}

main().catch((err) => {
  logger.error({ err }, '[worker] failed to start');
  process.exit(1);
});
