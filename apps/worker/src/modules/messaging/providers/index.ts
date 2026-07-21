import type { ConnectedAccountProvider } from '@saasly/database';
import type { CalendarProvider, MailProvider } from './types.js';
import { imapProvider } from './imap.provider.js';
import { gmailProvider } from './gmail.provider.js';
import { googleCalendarProvider } from '../../calendar/providers/google-calendar.provider.js';
import { caldavProvider } from '../../calendar/providers/caldav.provider.js';

const NOT_IMPLEMENTED: MailProvider = {
  listFolders: () => Promise.reject(new Error('Provider not implemented')),
  fetchNewMessages: () => Promise.reject(new Error('Provider not implemented')),
  sendMessage: () => Promise.reject(new Error('Provider not implemented')),
};

/** Resolve the mail provider driver for a connected account's provider. */
export function getMailProvider(provider: ConnectedAccountProvider): MailProvider {
  switch (provider) {
    case 'IMAP_SMTP_CALDAV':
      return imapProvider;
    case 'GOOGLE':
      return gmailProvider;
    // MICROSOFT is a scaffold only.
    default:
      return NOT_IMPLEMENTED;
  }
}

const NOT_IMPLEMENTED_CALENDAR: CalendarProvider = {
  fetchNewEvents: () => Promise.reject(new Error('Calendar provider not implemented')),
};

/** Resolve the calendar provider driver: Google Calendar for GOOGLE, CalDAV for IMAP/SMTP/CalDAV. */
export function getCalendarProvider(provider: ConnectedAccountProvider): CalendarProvider {
  switch (provider) {
    case 'GOOGLE':
      return googleCalendarProvider;
    case 'IMAP_SMTP_CALDAV':
      return caldavProvider;
    default:
      return NOT_IMPLEMENTED_CALENDAR;
  }
}

export type { MailProvider, CalendarProvider } from './types.js';
