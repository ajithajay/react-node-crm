import { calendar_v3, google } from 'googleapis';
import { getGoogleClient } from '../../messaging/providers/google-auth.js';
import { logger } from '../../../lib/logger.js';
import type { CalendarFetchResult, CalendarProvider, EventResponseStatus, NormalizedEventParticipant } from '../../messaging/providers/types.js';

const RESPONSE_MAP: Record<string, EventResponseStatus> = {
  needsAction: 'NEEDS_ACTION',
  declined: 'DECLINED',
  tentative: 'TENTATIVE',
  accepted: 'ACCEPTED',
};

function toParticipants(attendees: calendar_v3.Schema$EventAttendee[] | undefined): NormalizedEventParticipant[] {
  return (attendees ?? [])
    .filter((a) => a.email)
    .map((a) => ({
      handle: a.email!.toLowerCase(),
      displayName: a.displayName ?? null,
      isOrganizer: a.organizer ?? false,
      responseStatus: RESPONSE_MAP[a.responseStatus ?? 'needsAction'] ?? 'NEEDS_ACTION',
    }));
}

function toDate(dt: calendar_v3.Schema$EventDateTime | undefined): Date | null {
  const value = dt?.dateTime ?? dt?.date;
  return value ? new Date(value) : null;
}

export const googleCalendarProvider: CalendarProvider = {
  async fetchNewEvents(account, channel, opts) {
    const calendar = google.calendar({ version: 'v3', auth: getGoogleClient(account) });
    const result: CalendarFetchResult = { events: [], cursor: opts.cursor };

    const params: calendar_v3.Params$Resource$Events$List = {
      calendarId: 'primary',
      maxResults: opts.maxEvents,
      singleEvents: true,
      showDeleted: true,
    };
    if (!opts.fullSync && opts.cursor) params.syncToken = opts.cursor;
    else params.timeMin = new Date(Date.now() - 1000 * 60 * 60 * 24 * 365).toISOString();

    const { data } = await calendar.events.list(params);
    for (const event of data.items ?? []) {
      if (!event.id) continue;
      result.events.push({
        externalId: event.id,
        title: event.summary ?? '',
        description: event.description ?? '',
        location: event.location ?? '',
        startsAt: toDate(event.start),
        endsAt: toDate(event.end),
        isFullDay: !!event.start?.date,
        isCanceled: event.status === 'cancelled',
        iCalUid: event.iCalUID ?? '',
        conferenceLink: event.hangoutLink ?? '',
        participants: toParticipants(event.attendees),
      });
    }
    result.cursor = data.nextSyncToken ?? opts.cursor;
    logger.info({ channelId: channel.id, fetched: result.events.length }, '[google-calendar] fetch complete');
    return result;
  },
};
