/** One delivery attempt of a record event to a single webhook endpoint (producer: api, consumer: worker). */
export interface WebhookDeliveryJobData {
  webhookId: string;
  targetUrl: string;
  secret: string | null;
  /** e.g. "company.created" */
  eventName: string;
  payload: unknown;
  /** epoch millis when the event was emitted (part of the signed content). */
  timestamp: number;
}

export const WEBHOOK_DELIVERY_JOB_NAME = 'deliver-webhook' as const;
