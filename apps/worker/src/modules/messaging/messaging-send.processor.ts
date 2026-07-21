import { Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { QueueName, type MessageSendJobData } from '@saasly/shared';
import { env } from '../../lib/config.js';
import { logger } from '../../lib/logger.js';
import { sendMessage } from './send.service.js';

/** Consumes outbound email send jobs (compose / reply from the CRM). */
export function startMessagingSendWorker(): Worker<MessageSendJobData> {
  const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });

  const worker = new Worker<MessageSendJobData>(
    QueueName.MESSAGING_SEND,
    async (job) => {
      await sendMessage(job.data);
    },
    { connection, concurrency: 3 },
  );

  worker.on('error', (err) => logger.error({ err }, '[worker:messaging-send] error'));
  return worker;
}
