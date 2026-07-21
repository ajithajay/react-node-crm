import { Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { QueueName, type ChannelSyncJobData } from '@saasly/shared';
import { env } from '../../lib/config.js';
import { logger } from '../../lib/logger.js';
import { syncMessageChannel } from './sync.service.js';

/** Consumes messaging-sync ticks (cron + manual "Sync now"). Each tick syncs one channel. */
export function startMessagingSyncWorker(): Worker<ChannelSyncJobData> {
  const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });

  const worker = new Worker<ChannelSyncJobData>(
    QueueName.MESSAGING_SYNC,
    async (job) => {
      await syncMessageChannel(job.data.workspaceId, job.data.channelId);
    },
    { connection, concurrency: 3 },
  );

  worker.on('error', (err) => logger.error({ err }, '[worker:messaging-sync] error'));
  return worker;
}
