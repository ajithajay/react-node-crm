import { Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { WorkflowEntity, WorkflowRunEntity, WorkflowVersionEntity } from '@saasly/database';
import {
  QueueName,
  WorkflowRunStatus,
  buildInitialRunState,
  type CronTriggerJobData,
  type WorkflowStep,
  type WorkflowTrigger,
} from '@saasly/shared';
import { env } from '../../lib/config.js';
import { logger } from '../../lib/logger.js';
import { dataSource } from '../../lib/db.js';
import { enqueueWorkflowExecution } from './queue.js';

/** Consumes repeatable CRON jobs; each fire starts a run of the workflow's published version. */
export function startCronWorker(): Worker<CronTriggerJobData> {
  const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
  const worker = new Worker<CronTriggerJobData>(
    QueueName.CRON,
    async (job) => {
      const { workspaceId, workflowId } = job.data;
      const workflow = await dataSource
        .getRepository(WorkflowEntity)
        .findOneBy({ id: workflowId, workspaceId });
      if (!workflow?.lastPublishedVersionId) return;

      const version = await dataSource
        .getRepository(WorkflowVersionEntity)
        .findOneBy({ id: workflow.lastPublishedVersionId, workspaceId });
      if (!version?.trigger) return;

      const state = buildInitialRunState(
        version.trigger as WorkflowTrigger,
        (version.steps as unknown as WorkflowStep[]) ?? [],
        { firedAt: new Date().toISOString() },
      );
      const runRepo = dataSource.getRepository(WorkflowRunEntity);
      const run = await runRepo.save(
        runRepo.create({
          workspaceId,
          workflowId,
          workflowVersionId: version.id,
          status: WorkflowRunStatus.NOT_STARTED,
          state: state as unknown as Record<string, unknown>,
          enqueuedAt: new Date(),
        }),
      );
      await enqueueWorkflowExecution({ workspaceId, workflowRunId: run.id });
      logger.info({ workflowId, runId: run.id }, '[workflow] cron fired');
    },
    { connection },
  );

  worker.on('failed', (job, err) => logger.error({ err, jobId: job?.id }, '[workflow] cron job failed'));
  worker.on('error', (err) => logger.error({ err }, '[workflow] cron worker error'));
  return worker;
}
