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
import { sendMessage } from '../modules/messaging/send.service.js';

// Mailbox + recipient share a domain (internal). Internal recipients are matched to existing people
// but never auto-created (you don't auto-add colleagues), so this script pre-creates the recipient
// and asserts the sent message links to it.
const ACCOUNT_EMAIL = 'mail@example.com';
const RECIPIENT = 'mail@people.com';
const SUBDOMAIN = 'saasly';

function ok(l: string): void {
  console.log(`  ✓ ${l}`);
}
function assert(c: unknown, m: string): asserts c {
  if (!c) throw new Error(`ASSERTION FAILED: ${m}`);
}

async function cleanup(): Promise<void> {
  const existing = await dataSource.getRepository(WorkspaceEntity).findOneBy({ subdomain: SUBDOMAIN });
  if (existing) {
    await dropWorkspaceSchema(dataSource, existing.id).catch(() => undefined);
    await dataSource.getRepository(WorkspaceEntity).delete({ id: existing.id });
  }
  await dataSource.getRepository(UserEntity).delete({ email: ACCOUNT_EMAIL });
}

async function main(): Promise<void> {
  await dataSource.initialize();
  await fetch('http://localhost:8080/api/mail/purge', { method: 'POST' }).catch(() => undefined);
  await cleanup();

  const user = await dataSource.getRepository(UserEntity).save(
    dataSource.getRepository(UserEntity).create({ email: ACCOUNT_EMAIL, firstName: 'Sender', lastName: 'S', isEmailVerified: true }),
  );
  const workspace = await dataSource.getRepository(WorkspaceEntity).save(
    dataSource.getRepository(WorkspaceEntity).create({ name: 'Verify Send Co', subdomain: SUBDOMAIN, databaseSchema: '', syncInternalEmails: true }),
  );
  await provisionWorkspace(dataSource, workspace.id);
  const member = await dataSource.getRepository(WorkspaceMemberEntity).save(
    dataSource.getRepository(WorkspaceMemberEntity).create({ workspaceId: workspace.id, userId: user.id, firstName: 'Sender', lastName: 'S' }),
  );

  const ws = await workspaceDataSourceCache.getWorkspaceDataSource(workspace.id);
  const personRepo = ws.getRepository<Record<string, unknown>>('person');
  const recipientPerson = (await personRepo.save(
    personRepo.create({ name_first_name: 'People', name_last_name: 'Person', emails_primary_email: RECIPIENT, emails_additional_emails: [] }),
  )) as Record<string, unknown>;

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
      workspaceId: workspace.id, connectedAccountId: account.id, handle: ACCOUNT_EMAIL, contactAutoCreationPolicy: 'SENT',
    }),
  );
  await dataSource.getRepository(MessageFolderEntity).save(
    dataSource.getRepository(MessageFolderEntity).create({ workspaceId: workspace.id, messageChannelId: channel.id, name: 'INBOX', externalId: 'INBOX', isSynced: true }),
  );
  ok('workspace + account + channel + recipient Person ready');

  console.log('\nSend an email from the CRM');
  await sendMessage({
    workspaceId: workspace.id,
    connectedAccountId: account.id,
    messageChannelId: channel.id,
    to: [RECIPIENT],
    cc: [],
    bcc: [],
    subject: 'Hi People',
    body: 'Sent from the CRM.',
    inReplyToHeaderMessageId: null,
    messageThreadId: null,
  });
  ok('send.service completed (SMTP → GreenMail)');

  const messages = await ws.getRepository<Record<string, unknown>>('message').find();
  assert(messages.length === 1, `expected 1 outgoing message, got ${messages.length}`);
  ok('outgoing message stored');

  const assocs = await ws.getRepository<Record<string, unknown>>('message_channel_message_association').find();
  assert(assocs[0]?.direction === 'OUTGOING', 'association direction should be OUTGOING');
  ok('association marked OUTGOING');

  const participants = await ws.getRepository<Record<string, unknown>>('message_participant').find();
  assert(participants.some((p) => p.handle === ACCOUNT_EMAIL && p.role === 'FROM'), 'sender should be FROM participant');
  const recipientParticipant = participants.find((p) => p.handle === RECIPIENT && p.role === 'TO');
  assert(!!recipientParticipant, 'recipient should be a TO participant');
  assert(recipientParticipant!.person_id === recipientPerson.id, 'recipient participant should match the existing Person');
  ok('participants recorded and recipient matched to existing Person');

  await cleanup();
  console.log('\n✅ Send verify PASSED');
}

main().then(() => process.exit(0)).catch((err) => {
  console.error('\n❌ Send verify FAILED\n', err);
  process.exit(1);
});
