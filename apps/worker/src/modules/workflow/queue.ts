import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import {
  QueueName,
  WORKFLOW_EXECUTION_JOB_NAME,
  type WorkflowExecutionJobData,
} from '@saasly/shared';
import { env } from '../../lib/config.js';

// Producer used by the executor to re-enqueue continuations (DELAY resume, form resume). Shares one
// Redis connection.
const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
const workflowExecutionQueue = new Queue<WorkflowExecutionJobData>(QueueName.WORKFLOW_EXECUTION, { connection });

export async function enqueueWorkflowExecution(
  data: WorkflowExecutionJobData,
  opts?: { delayMs?: number },
): Promise<void> {
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
