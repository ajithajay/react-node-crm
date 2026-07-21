import type { CalendarEventDto, CalendarEventParticipantDto, TimelineObjectSingular } from '@saasly/shared';
import { workspaceDataSourceCache } from '../../lib/workspace-data-source.js';
import { resolveScope } from '../messaging/messaging.service.js';

type Row = Record<string, unknown>;

async function repo(workspaceId: string, singular: string) {
  const ws = await workspaceDataSourceCache.getWorkspaceDataSource(workspaceId);
  return ws.getRepository<Row>(singular);
}

function unprefix(row: Row, prefix: string): Row {
  const out: Row = {};
  for (const [k, v] of Object.entries(row)) out[k.startsWith(prefix) ? k.slice(prefix.length) : k] = v;
  return out;
}

/** Read-only calendar events for a Person/Company/Opportunity record. */
export async function listEvents(
  workspaceId: string,
  objectNameSingular: TimelineObjectSingular,
  recordId: string,
): Promise<{ events: CalendarEventDto[] }> {
  const scope = await resolveScope(workspaceId, objectNameSingular, recordId);
  if (scope.personIds.length === 0 && !scope.domain) return { events: [] };

  const participantRepo = await repo(workspaceId, 'calendar_event_participant');
  const qb = participantRepo.createQueryBuilder('cp').select('DISTINCT cp.calendar_event_id', 'eid');
  const conditions: string[] = [];
  const params: Record<string, unknown> = {};
  if (scope.personIds.length > 0) {
    conditions.push('cp.person_id IN (:...personIds)');
    params.personIds = scope.personIds;
  }
  if (scope.domain) {
    conditions.push('LOWER(cp.handle) LIKE :domainLike');
    params.domainLike = `%@${scope.domain}`;
  }
  const eventIdRows = await qb.where(`(${conditions.join(' OR ')})`, params).getRawMany<{ eid: string }>();
  const eventIds = eventIdRows.map((r) => r.eid).filter(Boolean);
  if (eventIds.length === 0) return { events: [] };

  const eventRepo = await repo(workspaceId, 'calendar_event');
  const events = await eventRepo
    .createQueryBuilder('e')
    .where('e.id IN (:...ids)', { ids: eventIds })
    .orderBy('e.starts_at', 'DESC')
    .getRawMany<Row>();

  const allParticipants = await participantRepo
    .createQueryBuilder('cp')
    .where('cp.calendar_event_id IN (:...ids)', { ids: eventIds })
    .getRawMany<Row>();

  const dtos: CalendarEventDto[] = events.map((e) => {
    const id = e.e_id as string;
    const participants: CalendarEventParticipantDto[] = allParticipants
      .filter((p) => p.cp_calendar_event_id === id)
      .map((p) => {
        const row = unprefix(p, 'cp_');
        return {
          handle: (row.handle as string) ?? '',
          displayName: (row.display_name as string) ?? null,
          personId: (row.person_id as string) ?? null,
          responseStatus: (row.response_status as string) ?? 'NEEDS_ACTION',
          isOrganizer: (row.is_organizer as boolean) ?? false,
        };
      });
    return {
      id,
      title: (e.e_title as string) ?? '',
      description: (e.e_description_markdown as string) ?? '',
      location: (e.e_location as string) ?? '',
      startsAt: e.e_starts_at ? new Date(e.e_starts_at as string).toISOString() : null,
      endsAt: e.e_ends_at ? new Date(e.e_ends_at as string).toISOString() : null,
      isFullDay: (e.e_is_full_day as boolean) ?? false,
      isCanceled: (e.e_is_canceled as boolean) ?? false,
      conferenceLink: (e.e_conference_link_primary_link_url as string) ?? null,
      participants,
    };
  });

  return { events: dtos };
}
