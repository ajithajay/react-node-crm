import nodemailer from 'nodemailer';

/**
 * Inject a test email into the local GreenMail server so you can exercise the CRM's inbound sync.
 * Usage: pnpm --filter @saasly/worker send-test-mail -- <to> [subject] [body] [from]
 * Example: pnpm --filter @saasly/worker send-test-mail -- me@example.com "Hi" "Test body" bob@acme.test
 */
async function main(): Promise<void> {
  const [to, subject, body, from] = process.argv.slice(2).filter((a) => a !== '--');
  if (!to) {
    console.error('Usage: send-test-mail -- <to> [subject] [body] [from]');
    process.exit(1);
  }
  const host = process.env.GREENMAIL_SMTP_HOST ?? 'localhost';
  const port = Number(process.env.GREENMAIL_SMTP_PORT ?? 3025);

  const transport = nodemailer.createTransport({ host, port, secure: false });
  const info = await transport.sendMail({
    from: from ?? 'Bob Tester <bob@acme.test>',
    to,
    subject: subject ?? 'Test message from send-test-mail',
    text: body ?? 'This is a test email injected into GreenMail for CRM sync testing.',
  });
  console.log(`✓ Sent to ${to} via ${host}:${port} (messageId ${info.messageId}). Now hit "Sync now" on the account.`);
}

main().catch((err) => {
  console.error('Failed to send test mail:', err);
  process.exit(1);
});
