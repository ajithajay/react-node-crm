/** Queue names shared by producers (api) and consumers (worker). */
export const QueueName = {
  EMAIL: 'email',
  WEBHOOK_DELIVERY: 'webhook-delivery',
  WORKFLOW_EXECUTION: 'workflow-execution',
  CRON: 'cron',
  CSV_IMPORT: 'csv-import',
  CSV_EXPORT: 'csv-export',
  HOUSEKEEPING: 'housekeeping',
} as const;
export type QueueName = (typeof QueueName)[keyof typeof QueueName];
