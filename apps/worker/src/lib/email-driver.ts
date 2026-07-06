import nodemailer from 'nodemailer';
import type { EmailJobData } from '@saasly/shared';
import { env } from './config.js';
import { logger } from './logger.js';

export interface EmailDriver {
  send(data: EmailJobData): Promise<void>;
}

function createSmtpDriver(): EmailDriver {
  const transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: false,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
  });
  return {
    async send(data) {
      await transport.sendMail({
        from: env.EMAIL_FROM,
        to: data.to,
        subject: data.subject,
        html: data.html,
        text: data.text,
      });
    },
  };
}

function createLogDriver(): EmailDriver {
  return {
    async send(data) {
      logger.info({ to: data.to, subject: data.subject }, '[email:log] would send email (EMAIL_DRIVER=log)');
    },
  };
}

/** Selected by EMAIL_DRIVER: `smtp` (real / Mailpit in dev) or `log` (no-op). */
export function createEmailDriver(): EmailDriver {
  return env.EMAIL_DRIVER === 'smtp' ? createSmtpDriver() : createLogDriver();
}
