import nodemailer from 'nodemailer';
import {
  ConnectedAccountEntity,
  MessageChannelEntity,
  MessageFolderEntity,
  UserEntity,
  WorkspaceEntity,
  WorkspaceMemberEntity,
  dropWorkspaceSchema,
  provisionWorkspace,
} from '@saasly/database';
import { dataSource, workspaceDataSourceCache } from '../lib/db.js';
import { encryptSecret } from '../lib/crypto.js';
import { syncMessageChannel } from '../modules/messaging/sync.service.js';

// Mailbox + contact on the SAME domain → the email is "internal". Internal email is only synced when
// the workspace `syncInternalEmails` flag is on (Settings → General → Security). This script mirrors
// that scenario: it enables the flag and pre-creates the contact, then checks the message syncs and
// matches. (For the external-domain flow — where contacts also auto-create — see the README notes.)
const ACCOUNT_EMAIL = 'mail@example.com';
const CONTACT_EMAIL = 'mail@people.com';
const SUBDOMAIN = 'saasly';

function ok(label: string): void {
  console.log(`  ✓ ${label}`);
}
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
}

async function cleanup(): Promise<void> {
  const existing = await dataSource.getRepository(WorkspaceEntity).findOneBy({ subdomain: SUBDOMAIN });
  if (existing) {
    await dropWorkspaceSchema(dataSource, existing.id).catch(() => undefined);
    await dataSource.getRepository(WorkspaceEntity).delete({ id: existing.id });
  }
  await dataSource.getRepository(UserEntity).delete({ email: ACCOUNT_EMAIL });
}

async function purgeGreenMail(): Promise<void> {
  await fetch('http://localhost:8080/api/mail/purge', { method: 'POST' }).catch(() => undefined);
}

async function main(): Promise<void> {
  await dataSource.initialize();
  console.log('[verify-imap-sync] core datasource ready');
  await cleanup();
  await purgeGreenMail();

  console.log('\n1. Provision workspace (with internal-email sync enabled) + the contact Person');
  const user = await dataSource.getRepository(UserEntity).save(
    dataSource.getRepository(UserEntity).create({ email: ACCOUNT_EMAIL, firstName: 'Mail', lastName: 'Owner', isEmailVerified: true }),
  );
  const workspace = await dataSource.getRepository(WorkspaceEntity).save(
    dataSource.getRepository(WorkspaceEntity).create({
      name: 'Verify IMAP Co',
      subdomain: SUBDOMAIN,
      databaseSchema: '',
      syncInternalEmails: true, // same-domain test → must be on
    }),
  );
  await provisionWorkspace(dataSource, workspace.id);
  const member = await dataSource.getRepository(WorkspaceMemberEntity).save(
    dataSource.getRepository(WorkspaceMemberEntity).create({ workspaceId: workspace.id, userId: user.id, firstName: 'Mail', lastName: 'Owner' }),
  );
  ok(`workspace ${workspace.id} provisioned`);

  const ws = await workspaceDataSourceCache.getWorkspaceDataSource(workspace.id);
  const personRepo = ws.getRepository<Record<string, unknown>>('person');
  const contact = (await personRepo.save(
    personRepo.create({ name_first_name: 'People', name_last_name: 'Person', emails_primary_email: CONTACT_EMAIL, emails_additional_emails: [] }),
  )) as Record<string, unknown>;
  ok(`contact person created for ${CONTACT_EMAIL} (${contact.id as string})`);

  console.log('\n2. Deliver an email into GreenMail (contact → mailbox)');
  const smtp = nodemailer.createTransport({ host: 'localhost', port: 3025, secure: false });
  await smtp.sendMail({
    from: `People Person <${CONTACT_EMAIL}>`,
    to: ACCOUNT_EMAIL,
    subject: 'Hello from People',
    text: 'This is a test message body for the IMAP sync verification.',
  });
  ok('email delivered to GreenMail');
  await new Promise((r) => setTimeout(r, 1500));

  console.log('\n3. Create connected account + message channel + INBOX folder');
  const account = await dataSource.getRepository(ConnectedAccountEntity).save(
    dataSource.getRepository(ConnectedAccountEntity).create({
      workspaceId: workspace.id,
      workspaceMemberId: member.id,
      provider: 'IMAP_SMTP_CALDAV',
      handle: ACCOUNT_EMAIL,
      authStatus: 'CONNECTED',
      connectionParameters: {
        imapHost: 'localhost', imapPort: 3143, imapSecure: false,
        smtpHost: 'localhost', smtpPort: 3025, smtpSecure: false,
        username: ACCOUNT_EMAIL, passwordCiphertext: encryptSecret('greenmail'),
      },
    }),
  );
  const channel = await dataSource.getRepository(MessageChannelEntity).save(
    dataSource.getRepository(MessageChannelEntity).create({
      workspaceId: workspace.id, connectedAccountId: account.id, handle: ACCOUNT_EMAIL,
    }),
  );
  await dataSource.getRepository(MessageFolderEntity).save(
    dataSource.getRepository(MessageFolderEntity).create({
      workspaceId: workspace.id, messageChannelId: channel.id, name: 'INBOX', externalId: 'INBOX', isSynced: true,
    }),
  );
  ok('connected account + channel + folder created');

  console.log('\n4. Run the sync');
  await syncMessageChannel(workspace.id, channel.id);

  console.log('\n5. Assert results');
  const messages = await ws.getRepository<Record<string, unknown>>('message').find();
  assert(messages.length === 1, `expected 1 message, got ${messages.length} (is syncInternalEmails on?)`);
  ok(`message stored: "${messages[0]!.subject as string}"`);

  const participants = await ws.getRepository<Record<string, unknown>>('message_participant').find();
  const contactParticipant = participants.find((p) => (p.handle as string) === CONTACT_EMAIL);
  assert(!!contactParticipant, 'contact should be a participant on the message');
  assert(contactParticipant!.person_id === contact.id, 'contact participant should be matched to the pre-created Person');
  ok('contact participant matched to the existing Person → email will show on their record');

  console.log('\n6. Idempotency: run sync again, expect no duplicate message');
  await syncMessageChannel(workspace.id, channel.id);
  const messagesAfter = await ws.getRepository<Record<string, unknown>>('message').find();
  assert(messagesAfter.length === 1, `expected still 1 message after re-sync, got ${messagesAfter.length}`);
  ok('re-sync produced no duplicates');

  console.log('\n7. Cleanup');
  await cleanup();
  ok('workspace removed');

  console.log('\n✅ IMAP sync verify PASSED');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌ IMAP sync verify FAILED\n', err);
    process.exit(1);
  });
