import { Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { QueueName, type ChannelSyncJobData } from '@saasly/shared';
import { env } from '../../lib/config.js';
import { logger } from '../../lib/logger.js';
import { syncCalendarChannel } from '../messaging/sync.service.js';

/** Consumes calendar-sync ticks. Calendar sync logic lands in Phase E. */
export function startCalendarSyncWorker(): Worker<ChannelSyncJobData> {
  const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });

  const worker = new Worker<ChannelSyncJobData>(
    QueueName.CALENDAR_SYNC,
    async (job) => {
      await syncCalendarChannel(job.data.workspaceId, job.data.channelId);
    },
    { connection, concurrency: 3 },
  );

  worker.on('error', (err) => logger.error({ err }, '[worker:calendar-sync] error'));
  return worker;
}
