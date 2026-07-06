import { logger } from './lib/logger.js';
import { startEmailWorker } from './modules/email/email.processor.js';

async function main(): Promise<void> {
  const emailWorker = startEmailWorker();
  await emailWorker.waitUntilReady();
  logger.info('[worker] ready — connected to Redis, listening on queue: email');
}

main().catch((err) => {
  logger.error({ err }, '[worker] failed to start');
  process.exit(1);
});
