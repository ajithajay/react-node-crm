import { Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { QueueName, type EmailJobData } from '@saasly/shared';
import { env } from '../../lib/config.js';
import { logger } from '../../lib/logger.js';
import { createEmailDriver } from '../../lib/email-driver.js';

export function startEmailWorker(): Worker<EmailJobData> {
  const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
  const driver = createEmailDriver();

  const worker = new Worker<EmailJobData>(
    QueueName.EMAIL,
    async (job) => {
      await driver.send(job.data);
      logger.info({ jobId: job.id, to: job.data.to }, 'email sent');
    },
    { connection },
  );

  worker.on('error', (err) => logger.error({ err }, '[worker:email] error'));
  return worker;
}
