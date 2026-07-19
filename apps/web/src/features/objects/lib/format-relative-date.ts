import { formatDistance, isToday, isYesterday } from 'date-fns';

/** Relative time for a date/date-time value, shared by the table and detail page. */
export function formatRelativeDate(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  return formatDistance(date, new Date(), { addSuffix: true });
}
