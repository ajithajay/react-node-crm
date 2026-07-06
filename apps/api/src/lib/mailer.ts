import {
  renderEmail,
  VerifyEmailTemplate,
  PasswordResetTemplate,
  PasswordChangedTemplate,
} from '@saasly/emails';
import { enqueueEmail } from './queue.js';

export async function sendVerifyEmail(to: string, verifyUrl: string): Promise<void> {
  const { html, text } = await renderEmail(VerifyEmailTemplate({ verifyUrl }));
  await enqueueEmail({ to, subject: 'Verify your email', html, text });
}

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  const { html, text } = await renderEmail(PasswordResetTemplate({ resetUrl }));
  await enqueueEmail({ to, subject: 'Reset your password', html, text });
}

export async function sendPasswordChangedEmail(to: string): Promise<void> {
  const { html, text } = await renderEmail(PasswordChangedTemplate());
  await enqueueEmail({ to, subject: 'Your password was changed', html, text });
}
