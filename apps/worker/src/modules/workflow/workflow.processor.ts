import { Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { QueueName, type WorkflowExecutionJobData } from '@saasly/shared';
import { env } from '../../lib/config.js';
import { logger } from '../../lib/logger.js';
import { executeRun } from './executor.js';

export function startWorkflowWorker(): Worker<WorkflowExecutionJobData> {
  const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
  const worker = new Worker<WorkflowExecutionJobData>(
    QueueName.WORKFLOW_EXECUTION,
    async (job) => {
      await executeRun(job.data);
    },
    { connection },
  );

  worker.on('failed', (job, err) => {
    logger.error({ err, jobId: job?.id, runId: job?.data.workflowRunId }, '[workflow] execution job failed');
  });
  worker.on('error', (err) => logger.error({ err }, '[workflow] worker error'));

  return worker;
}
