import { Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { HOUSEKEEPING_JOB_NAME, HousekeepingTask, QueueName, type HousekeepingJobData } from '@saasly/shared';
import { env } from '../../lib/config.js';
import { logger } from '../../lib/logger.js';
import { runFileCleanup, runLogRetention, runSessionCleanup, runTrashCleanup } from './housekeeping-tasks.js';

const TASK_RUNNERS: Record<HousekeepingTask, () => Promise<void>> = {
  [HousekeepingTask.TRASH_CLEANUP]: runTrashCleanup,
  [HousekeepingTask.FILE_CLEANUP]: runFileCleanup,
  [HousekeepingTask.LOG_RETENTION]: runLogRetention,
  [HousekeepingTask.SESSION_CLEANUP]: runSessionCleanup,
};

/** Daily, staggered a few minutes apart so the sweeps don't all hit the DB at once. */
const SCHEDULE: { task: HousekeepingTask; pattern: string }[] = [
  { task: HousekeepingTask.TRASH_CLEANUP, pattern: '0 3 * * *' },
  { task: HousekeepingTask.FILE_CLEANUP, pattern: '10 3 * * *' },
  { task: HousekeepingTask.LOG_RETENTION, pattern: '20 3 * * *' },
  { task: HousekeepingTask.SESSION_CLEANUP, pattern: '30 3 * * *' },
];

export function startHousekeepingWorker(): Worker<HousekeepingJobData> {
  const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
  const worker = new Worker<HousekeepingJobData>(
    QueueName.HOUSEKEEPING,
    async (job) => {
      await TASK_RUNNERS[job.data.task]();
    },
    { connection },
  );

  worker.on('failed', (job, err) => logger.error({ err, task: job?.data.task }, '[housekeeping] job failed'));
  worker.on('error', (err) => logger.error({ err }, '[housekeeping] worker error'));
  return worker;
}

/**
 * Self-scheduled — unlike workflow cron triggers (per-workflow, registered by the API), these are
 * system-wide maintenance sweeps with one fixed schedule, so the worker registers its own
 * repeatable jobs at boot. Idempotent: removes any existing repeatable job with the same id first,
 * so restarting the worker never produces duplicate schedules.
 */
export async function scheduleHousekeepingJobs(): Promise<void> {
  const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
  const queue = new Queue<HousekeepingJobData>(QueueName.HOUSEKEEPING, { connection });

  for (const { task, pattern } of SCHEDULE) {
    const jobId = `housekeeping__${task}`;
    const repeatable = await queue.getRepeatableJobs();
    await Promise.all(
      repeatable.filter((job) => job.id === jobId).map((job) => queue.removeRepeatableByKey(job.key)),
    );
    await queue.add(
      HOUSEKEEPING_JOB_NAME,
      { task },
      { jobId, repeat: { pattern }, removeOnComplete: 20, removeOnFail: 20 },
    );
  }
  logger.info({ tasks: SCHEDULE.map((s) => s.task) }, '[housekeeping] schedules registered');
}
