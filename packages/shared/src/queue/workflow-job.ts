/**
 * Job payloads for QueueName.WORKFLOW_EXECUTION and QueueName.CRON (producer: api, consumer: worker).
 * A single execution job either starts a run (`runId` freshly created) or resumes/continues one.
 */
export interface WorkflowExecutionJobData {
  workspaceId: string;
  workflowRunId: string;
  /** When set, resume execution from this step's successors (job re-chaining for long/paused runs). */
  lastExecutedStepId?: string;
  /** When set, resume a specific step that was PENDING (FORM submit / DELAY elapsed). */
  resumeStepId?: string;
}

export const WORKFLOW_EXECUTION_JOB_NAME = 'run-workflow' as const;

/**
 * Repeatable-job payload placed on QueueName.CRON via BullMQ `repeat`. When the pattern fires, the
 * worker creates a run for the workflow's published version and enqueues a WORKFLOW_EXECUTION job.
 */
export interface CronTriggerJobData {
  workspaceId: string;
  workflowId: string;
}

export const CRON_TRIGGER_JOB_NAME = 'fire-cron-workflow' as const;
