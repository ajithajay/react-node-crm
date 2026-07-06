import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { QueueName, EMAIL_JOB_NAME, type EmailJobData } from '@saasly/shared';
import { env } from './config.js';

const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });

export const emailQueue = new Queue<EmailJobData>(QueueName.EMAIL, { connection });

export async function enqueueEmail(data: EmailJobData): Promise<void> {
  await emailQueue.add(EMAIL_JOB_NAME, data, { attempts: 3, backoff: { type: 'exponential', delay: 5000 } });
}
