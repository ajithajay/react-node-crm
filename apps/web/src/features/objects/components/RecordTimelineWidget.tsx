import { useQuery } from '@tanstack/react-query';
import { recordApi } from '@/lib/api-client';

/**
 * Timeline tab — a real query against `timeline_activities` filtered by the MORPH_RELATION
 * target_type/target_id pair (no placeholder data). Nothing in this codebase yet *writes* activity
 * rows automatically (no auto-logging-on-create/update/email/call feature exists), so this will
 * legitimately show "no activity yet" until that separate feature is built — that's an honest gap,
 * not a bug in this widget.
 */
export function RecordTimelineWidget({
  sourceObjectNameSingular,
  sourceRecordId,
}: {
  sourceObjectNameSingular: string;
  sourceRecordId: string;
}) {
  const { data } = useQuery({
    queryKey: ['record-timeline', sourceRecordId],
    queryFn: () =>
      recordApi.list('timeline_activities', {
        filter: [
          { field: 'targetType', operand: 'IS', value: sourceObjectNameSingular },
          { field: 'targetId', operand: 'IS', value: sourceRecordId },
        ],
        sortField: 'happensAt',
        sortDirection: 'DESC',
        pageSize: 100,
      }),
  });

  const activities = data?.records ?? [];

  return (
    <div className="space-y-2 py-4">
      <span className="text-sm font-medium">Timeline</span>
      <div className="space-y-1.5">
        {activities.map((a) => (
          <div key={a.id as string} className="rounded border px-2 py-1.5 text-sm">
            <div>{String(a.name ?? '')}</div>
            {!!a.happensAt && (
              <div className="text-xs text-muted-foreground">{new Date(a.happensAt as string).toLocaleString()}</div>
            )}
          </div>
        ))}
        {activities.length === 0 && (
          <p className="text-xs text-muted-foreground">
            No activity yet. Timeline entries aren&apos;t generated automatically yet — this tab
            will show real data once an activity-logging feature writes to timeline_activities.
          </p>
        )}
      </div>
    </div>
  );
}
