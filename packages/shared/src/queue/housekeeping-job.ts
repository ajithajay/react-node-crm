/**
 * Recurring maintenance sweeps (producer: worker itself, consumer: worker) — trash/soft-delete
 * cleanup, stale-file cleanup, audit-log retention, and expired-session cleanup. Self-scheduled at
 * worker boot (no per-tenant/per-workflow scheduling needed), unlike workflow cron triggers.
 */
export const HousekeepingTask = {
  TRASH_CLEANUP: 'TRASH_CLEANUP',
  FILE_CLEANUP: 'FILE_CLEANUP',
  LOG_RETENTION: 'LOG_RETENTION',
  SESSION_CLEANUP: 'SESSION_CLEANUP',
} as const;
export type HousekeepingTask = (typeof HousekeepingTask)[keyof typeof HousekeepingTask];

export interface HousekeepingJobData {
  task: HousekeepingTask;
}

export const HOUSEKEEPING_JOB_NAME = 'run-housekeeping-task' as const;
