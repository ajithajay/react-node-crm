/** Job payload for QueueName.EMAIL. The producer (api) renders the template; the worker only sends. */
export interface EmailJobData {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export const EMAIL_JOB_NAME = 'send-email' as const;
