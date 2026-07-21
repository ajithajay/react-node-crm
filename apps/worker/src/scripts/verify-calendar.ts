import {
  CalendarChannelEntity,
  ConnectedAccountEntity,
  UserEntity,
  WorkspaceEntity,
  WorkspaceMemberEntity,
  dropWorkspaceSchema,
  provisionWorkspace,
} from '@saasly/database';
import { dataSource, workspaceDataSourceCache } from '../lib/db.js';
import { encryptSecret } from '../lib/crypto.js';
import { findPersonIdByEmail, findWorkspaceMemberIdByEmail, storeEvent } from '../modules/messaging/record-store.js';
import type { NormalizedEvent } from '../modules/messaging/providers/types.js';

const ACCOUNT_EMAIL = 'mail@example.com';
const ATTENDEE = 'people@example.com';
const SUBDOMAIN = 'verify-calendar';

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
  await cleanup();

  const user = await dataSource.getRepository(UserEntity).save(
    dataSource.getRepository(UserEntity).create({ email: ACCOUNT_EMAIL, firstName: 'Cal', lastName: 'Owner', isEmailVerified: true }),
  );
  const workspace = await dataSource.getRepository(WorkspaceEntity).save(
    dataSource.getRepository(WorkspaceEntity).create({ name: 'Verify Calendar Co', subdomain: SUBDOMAIN, databaseSchema: '', syncInternalEmails: true }),
  );
  await provisionWorkspace(dataSource, workspace.id);
  const member = await dataSource.getRepository(WorkspaceMemberEntity).save(
    dataSource.getRepository(WorkspaceMemberEntity).create({ workspaceId: workspace.id, userId: user.id, firstName: 'Cal', lastName: 'Owner' }),
  );
  const account = await dataSource.getRepository(ConnectedAccountEntity).save(
    dataSource.getRepository(ConnectedAccountEntity).create({
      workspaceId: workspace.id, workspaceMemberId: member.id, provider: 'GOOGLE', handle: ACCOUNT_EMAIL, authStatus: 'CONNECTED',
      accessTokenCiphertext: encryptSecret('x'),
    }),
  );
  const channel = await dataSource.getRepository(CalendarChannelEntity).save(
    dataSource.getRepository(CalendarChannelEntity).create({ workspaceId: workspace.id, connectedAccountId: account.id, handle: ACCOUNT_EMAIL }),
  );

  const ws = await workspaceDataSourceCache.getWorkspaceDataSource(workspace.id);
  const personRepo = ws.getRepository<Record<string, unknown>>('person');
  const contact = (await personRepo.save(
    personRepo.create({ name_first_name: 'People', name_last_name: 'Person', emails_primary_email: ATTENDEE, emails_additional_emails: [] }),
  )) as Record<string, unknown>;
  ok('workspace + calendar channel + contact ready');

  const event: NormalizedEvent = {
    externalId: 'evt-123',
    title: 'Project sync',
    description: 'Weekly catch-up',
    location: 'Zoom',
    startsAt: new Date('2026-08-01T10:00:00Z'),
    endsAt: new Date('2026-08-01T10:30:00Z'),
    isFullDay: false,
    isCanceled: false,
    iCalUid: 'evt-123@example.com',
    conferenceLink: 'https://zoom.example/abc',
    participants: [
      { handle: ACCOUNT_EMAIL, displayName: 'Cal Owner', isOrganizer: true, responseStatus: 'ACCEPTED' },
      { handle: ATTENDEE, displayName: 'People Person', isOrganizer: false, responseStatus: 'ACCEPTED' },
    ],
  };
  const resolutions = new Map();
  for (const p of event.participants) {
    resolutions.set(p.handle, {
      personId: await findPersonIdByEmail(workspace.id, p.handle),
      workspaceMemberId: await findWorkspaceMemberIdByEmail(workspace.id, p.handle),
    });
  }

  console.log('\nStore the event');
  const first = await storeEvent({ workspaceId: workspace.id, calendarChannelId: channel.id, event, resolutions });
  assert(first.created, 'event should be created');
  const second = await storeEvent({ workspaceId: workspace.id, calendarChannelId: channel.id, event, resolutions });
  assert(!second.created, 're-store should be idempotent (no duplicate)');
  ok('event stored + idempotent on re-store');

  const events = await ws.getRepository<Record<string, unknown>>('calendar_event').find();
  assert(events.length === 1, `expected 1 event, got ${events.length}`);
  ok(`event stored: "${events[0]!.title as string}"`);

  const participants = await ws.getRepository<Record<string, unknown>>('calendar_event_participant').find();
  const attendee = participants.find((p) => p.handle === ATTENDEE);
  assert(attendee?.person_id === contact.id, 'attendee should be matched to the existing Person → shows on their Calendar tab');
  ok('attendee matched to the contact Person');

  // Replicate the Calendar-tab read query: events where a participant.person_id = the contact.
  const eventIdRows = await ws
    .getRepository<Record<string, unknown>>('calendar_event_participant')
    .createQueryBuilder('cp')
    .select('DISTINCT cp.calendar_event_id', 'eid')
    .where('cp.person_id = :pid', { pid: contact.id })
    .getRawMany<{ eid: string }>();
  assert(eventIdRows.length === 1, 'read path should surface exactly one event for the contact');
  ok('read path returns the event for the contact record');

  await cleanup();
  console.log('\n✅ Calendar verify PASSED');
}

main().then(() => process.exit(0)).catch((err) => {
  console.error('\n❌ Calendar verify FAILED\n', err);
  process.exit(1);
});
