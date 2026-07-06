/** Queue names shared by producers (api) and consumers (worker) — solution-approach.md §7. */
export const QueueName = {
  EMAIL: 'email',
  WEBHOOK_DELIVERY: 'webhook-delivery',
  WORKFLOW_EXECUTION: 'workflow-execution',
  CRON: 'cron',
  CSV_IMPORT: 'csv-import',
  CSV_EXPORT: 'csv-export',
} as const;
export type QueueName = (typeof QueueName)[keyof typeof QueueName];
