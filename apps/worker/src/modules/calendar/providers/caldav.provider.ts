import { DAVClient } from 'tsdav';
import ical from 'node-ical';
import { decryptSecret } from '../../../lib/crypto.js';
import { logger } from '../../../lib/logger.js';
import type { CalendarFetchResult, CalendarProvider, NormalizedEvent, NormalizedEventParticipant } from '../../messaging/providers/types.js';

/** Extract an email address from a node-ical attendee/organizer value (string or object). */
function emailOf(value: unknown): string | null {
  if (!value) return null;
  const raw = typeof value === 'string' ? value : ((value as { val?: string }).val ?? '');
  const match = /mailto:([^\s;>]+)/i.exec(raw) ?? /([^\s;<>]+@[^\s;<>]+)/.exec(raw);
  return match?.[1]?.toLowerCase() ?? null;
}

function attendees(ev: Record<string, unknown>): NormalizedEventParticipant[] {
  const raw = ev.attendee;
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const organizerEmail = emailOf(ev.organizer);
  const out: NormalizedEventParticipant[] = [];
  for (const a of list) {
    const handle = emailOf(a);
    if (!handle) continue;
    const params = (a as { params?: Record<string, string> }).params ?? {};
    const status = (params.PARTSTAT ?? '').toUpperCase();
    out.push({
      handle,
      displayName: params.CN ?? null,
      isOrganizer: handle === organizerEmail,
      responseStatus:
        status === 'ACCEPTED' || status === 'DECLINED' || status === 'TENTATIVE' ? status : 'NEEDS_ACTION',
    });
  }
  if (organizerEmail && !out.some((p) => p.handle === organizerEmail)) {
    out.push({ handle: organizerEmail, displayName: null, isOrganizer: true, responseStatus: 'ACCEPTED' });
  }
  return out;
}

export const caldavProvider: CalendarProvider = {
  async fetchNewEvents(account, channel, opts) {
    const params = account.connectionParameters;
    if (!params?.caldavUrl) throw new Error('CalDAV URL is not configured for this account');
    const password = params.passwordCiphertext ? decryptSecret(params.passwordCiphertext) : '';

    const client = new DAVClient({
      serverUrl: params.caldavUrl,
      credentials: { username: params.username ?? account.handle, password },
      authMethod: 'Basic',
      defaultAccountType: 'caldav',
    });
    await client.login();
    const calendars = await client.fetchCalendars();

    const result: CalendarFetchResult = { events: [], cursor: opts.cursor };
    let budget = opts.maxEvents;
    for (const calendar of calendars) {
      if (budget <= 0) break;
      const objects = await client.fetchCalendarObjects({ calendar });
      for (const obj of objects) {
        if (budget <= 0) break;
        if (!obj.data) continue;
        const parsed = await ical.async.parseICS(obj.data).catch(() => ({}) as Record<string, ical.CalendarComponent>);
        for (const component of Object.values(parsed)) {
          const ev = component as unknown as Record<string, unknown>;
          if (ev.type !== 'VEVENT') continue;
          const event: NormalizedEvent = {
            externalId: (ev.uid as string) ?? '',
            title: (ev.summary as string) ?? '',
            description: (ev.description as string) ?? '',
            location: (ev.location as string) ?? '',
            startsAt: ev.start ? new Date(ev.start as string) : null,
            endsAt: ev.end ? new Date(ev.end as string) : null,
            isFullDay: (ev.datetype as string) === 'date',
            isCanceled: (ev.status as string) === 'CANCELLED',
            iCalUid: (ev.uid as string) ?? '',
            conferenceLink: (ev.url as string) ?? '',
            participants: attendees(ev),
          };
          if (event.externalId) {
            result.events.push(event);
            budget -= 1;
          }
        }
      }
    }
    logger.info({ channelId: channel.id, fetched: result.events.length }, '[caldav] fetch complete');
    return result;
  },
};
