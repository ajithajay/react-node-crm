import { useQuery } from '@tanstack/react-query';
import { CalendarClock, MapPin, Video } from 'lucide-react';
import type { TimelineObjectSingular } from '@saasly/shared';
import { Badge } from '@/components/ui/badge';
import { calendarApi } from '@/lib/api-client';

const TIMELINE_SINGULARS = new Set(['person', 'company', 'opportunity']);

function formatRange(startsAt: string | null, endsAt: string | null, isFullDay: boolean): string {
  if (!startsAt) return '';
  const start = new Date(startsAt);
  if (isFullDay) return start.toLocaleDateString();
  const startStr = start.toLocaleString();
  if (!endsAt) return startStr;
  const end = new Date(endsAt);
  const sameDay = start.toDateString() === end.toDateString();
  return `${startStr} – ${sameDay ? end.toLocaleTimeString() : end.toLocaleString()}`;
}

/** Read-only calendar events on a Person/Company/Opportunity record. */
export function RecordCalendarWidget({
  objectNameSingular,
  recordId,
}: {
  objectNameSingular: string;
  recordId: string;
}) {
  const isSupported = TIMELINE_SINGULARS.has(objectNameSingular);
  const { data, isLoading } = useQuery({
    queryKey: ['calendar-events', objectNameSingular, recordId],
    queryFn: () => calendarApi.listEvents(objectNameSingular as TimelineObjectSingular, recordId),
    enabled: isSupported,
  });

  if (!isSupported) {
    return <p className="text-sm text-muted-foreground">Calendar is available on People, Companies, and Opportunities.</p>;
  }
  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  if (!data || data.events.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-10 text-center">
        <CalendarClock className="size-7 text-muted-foreground" />
        <p className="text-sm font-medium">No events yet</p>
        <p className="text-xs text-muted-foreground">
          Connect a Google or CalDAV calendar in Settings → Accounts. Meetings with this contact will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y rounded-lg border">
      {data.events.map((event) => (
        <div key={event.id} className="flex flex-col gap-1 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className={`truncate text-sm font-medium ${event.isCanceled ? 'line-through opacity-60' : ''}`}>
              {event.title || '(no title)'}
            </p>
            <span className="shrink-0 text-xs text-muted-foreground">
              {formatRange(event.startsAt, event.endsAt, event.isFullDay)}
            </span>
          </div>
          {event.location && (
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="size-3" /> {event.location}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {event.conferenceLink && (
              <a
                href={event.conferenceLink}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <Video className="size-3" /> Join
              </a>
            )}
            <span className="text-xs text-muted-foreground">
              {event.participants.map((p) => p.displayName || p.handle).join(', ')}
            </span>
            {event.isCanceled && <Badge variant="outline">Canceled</Badge>}
          </div>
        </div>
      ))}
    </div>
  );
}
