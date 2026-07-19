import { logger } from './lib/logger.js';
import { dataSource } from './lib/db.js';
import { startEmailWorker } from './modules/email/email.processor.js';
import { startWebhookWorker } from './modules/webhook/webhook.processor.js';
import { startWorkflowWorker } from './modules/workflow/workflow.processor.js';
import { startCronWorker } from './modules/workflow/cron.processor.js';
import { scheduleHousekeepingJobs, startHousekeepingWorker } from './modules/housekeeping/housekeeping.processor.js';

async function main(): Promise<void> {
  // Workflow execution needs the core + workspace datasources (record CRUD).
  await dataSource.initialize();

  const emailWorker = startEmailWorker();
  const webhookWorker = startWebhookWorker();
  const workflowWorker = startWorkflowWorker();
  const cronWorker = startCronWorker();
  const housekeepingWorker = startHousekeepingWorker();
  await Promise.all([
    emailWorker.waitUntilReady(),
    webhookWorker.waitUntilReady(),
    workflowWorker.waitUntilReady(),
    cronWorker.waitUntilReady(),
    housekeepingWorker.waitUntilReady(),
  ]);
  await scheduleHousekeepingJobs();
  logger.info(
    '[worker] ready — connected to Redis, listening on queues: email, webhook-delivery, workflow-execution, cron, housekeeping',
  );
}

main().catch((err) => {
  logger.error({ err }, '[worker] failed to start');
  process.exit(1);
});
