import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import {
  QueueName,
  EMAIL_JOB_NAME,
  WEBHOOK_DELIVERY_JOB_NAME,
  WORKFLOW_EXECUTION_JOB_NAME,
  CRON_TRIGGER_JOB_NAME,
  MESSAGING_SYNC_JOB_NAME,
  CALENDAR_SYNC_JOB_NAME,
  MESSAGING_SEND_JOB_NAME,
  type EmailJobData,
  type WebhookDeliveryJobData,
  type WorkflowExecutionJobData,
  type CronTriggerJobData,
  type ChannelSyncJobData,
  type ChannelSyncPhase,
  type MessageSendJobData,
} from '@saasly/shared';
import { env } from './config.js';

const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });

export const emailQueue = new Queue<EmailJobData>(QueueName.EMAIL, { connection });

export async function enqueueEmail(data: EmailJobData): Promise<void> {
  await emailQueue.add(EMAIL_JOB_NAME, data, { attempts: 3, backoff: { type: 'exponential', delay: 5000 } });
}

export const webhookDeliveryQueue = new Queue<WebhookDeliveryJobData>(QueueName.WEBHOOK_DELIVERY, { connection });

export async function enqueueWebhookDelivery(data: WebhookDeliveryJobData): Promise<void> {
  await webhookDeliveryQueue.add(WEBHOOK_DELIVERY_JOB_NAME, data, {
    attempts: env.WEBHOOK_MAX_ATTEMPTS,
    backoff: { type: 'exponential', delay: env.WEBHOOK_RETRY_BACKOFF_MS },
    removeOnComplete: 1000,
    removeOnFail: 5000,
  });
}

export const workflowExecutionQueue = new Queue<WorkflowExecutionJobData>(QueueName.WORKFLOW_EXECUTION, {
  connection,
});

export async function enqueueWorkflowExecution(
  data: WorkflowExecutionJobData,
  opts?: { delayMs?: number },
): Promise<void> {
  // jobId keyed by (run, step) makes duplicate deliveries idempotent at the queue level.
  // BullMQ custom ids cannot contain ":" — use "__" as the separator.
  const jobId = `${data.workflowRunId}__${data.resumeStepId ?? data.lastExecutedStepId ?? 'start'}`;
  await workflowExecutionQueue.add(WORKFLOW_EXECUTION_JOB_NAME, data, {
    jobId,
    delay: opts?.delayMs,
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: 1000,
    removeOnFail: 5000,
  });
}

export const cronQueue = new Queue<CronTriggerJobData>(QueueName.CRON, { connection });

/** Register (or replace) a repeatable cron job for a workflow. `repeatKey`/`jobId` keep it unique. */
export async function upsertCronTrigger(
  data: CronTriggerJobData,
  pattern: string,
): Promise<void> {
  const jobId = `cron__${data.workflowId}`;
  await removeCronTrigger(data.workflowId);
  await cronQueue.add(CRON_TRIGGER_JOB_NAME, data, {
    jobId,
    repeat: { pattern },
    removeOnComplete: 100,
    removeOnFail: 100,
  });
}

export async function removeCronTrigger(workflowId: string): Promise<void> {
  const jobId = `cron__${workflowId}`;
  const repeatable = await cronQueue.getRepeatableJobs();
  await Promise.all(
    repeatable.filter((job) => job.id === jobId).map((job) => cronQueue.removeRepeatableByKey(job.key)),
  );
}

// ---- Messaging & calendar sync (connected accounts) ----

export const messagingSyncQueue = new Queue<ChannelSyncJobData>(QueueName.MESSAGING_SYNC, { connection });
export const calendarSyncQueue = new Queue<ChannelSyncJobData>(QueueName.CALENDAR_SYNC, { connection });
export const messagingSendQueue = new Queue<MessageSendJobData>(QueueName.MESSAGING_SEND, { connection });

/** Immediate one-off sync tick — used by the "Sync now" button and the first sync after connect. */
export async function enqueueMessageChannelSync(data: ChannelSyncJobData): Promise<void> {
  await messagingSyncQueue.add(MESSAGING_SYNC_JOB_NAME, data, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 10000 },
    removeOnComplete: 200,
    removeOnFail: 500,
  });
}

export async function enqueueCalendarChannelSync(data: ChannelSyncJobData): Promise<void> {
  await calendarSyncQueue.add(CALENDAR_SYNC_JOB_NAME, data, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 10000 },
    removeOnComplete: 200,
    removeOnFail: 500,
  });
}

export async function enqueueMessageSend(data: MessageSendJobData): Promise<void> {
  await messagingSendQueue.add(MESSAGING_SEND_JOB_NAME, data, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: 500,
    removeOnFail: 1000,
  });
}

async function removeRepeatable(queue: Queue<ChannelSyncJobData>, jobId: string): Promise<void> {
  const repeatable = await queue.getRepeatableJobs();
  await Promise.all(
    repeatable.filter((job) => job.id === jobId).map((job) => queue.removeRepeatableByKey(job.key)),
  );
}

/**
 * Register (or replace) a repeatable sync cron for one channel+phase. `jobId` keeps it unique so a
 * re-connect of the same channel re-arms rather than duplicating.
 */
export async function upsertMessageChannelSyncCron(data: ChannelSyncJobData, pattern: string): Promise<void> {
  const jobId = `msgsync__${data.channelId}__${data.phase}`;
  await removeRepeatable(messagingSyncQueue, jobId);
  await messagingSyncQueue.add(MESSAGING_SYNC_JOB_NAME, data, {
    jobId,
    repeat: { pattern },
    removeOnComplete: 100,
    removeOnFail: 100,
  });
}

export async function upsertCalendarChannelSyncCron(data: ChannelSyncJobData, pattern: string): Promise<void> {
  const jobId = `calsync__${data.channelId}__${data.phase}`;
  await removeRepeatable(calendarSyncQueue, jobId);
  await calendarSyncQueue.add(CALENDAR_SYNC_JOB_NAME, data, {
    jobId,
    repeat: { pattern },
    removeOnComplete: 100,
    removeOnFail: 100,
  });
}

/** Remove every repeatable sync cron for a message channel (both phases). */
export async function removeMessageChannelSyncCrons(channelId: string): Promise<void> {
  for (const phase of ['LIST_FETCH', 'IMPORT'] as ChannelSyncPhase[]) {
    await removeRepeatable(messagingSyncQueue, `msgsync__${channelId}__${phase}`);
  }
}

export async function removeCalendarChannelSyncCrons(channelId: string): Promise<void> {
  for (const phase of ['LIST_FETCH', 'IMPORT'] as ChannelSyncPhase[]) {
    await removeRepeatable(calendarSyncQueue, `calsync__${channelId}__${phase}`);
  }
}
