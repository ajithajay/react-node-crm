import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { CirclePlus, Pencil } from 'lucide-react';
import { type DataModelField, recordApi } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { fieldIcon } from '../lib/field-icon';
import { formatFieldValue, friendlyFieldKey } from '../lib/field-values';
import { formatRelativeDate } from '../lib/format-relative-date';

interface FieldDiffEntry {
  label: string;
  before: unknown;
  after: unknown;
}

/** One field's before→after line inside an expanded multi-field update entry. */
function DiffLine({ fieldByName, name, entry }: { fieldByName: Map<string, DataModelField>; name: string; entry: FieldDiffEntry }) {
  const field = fieldByName.get(name);
  const Icon = field ? fieldIcon(field) : null;
  const afterText = field ? formatFieldValue(field, { [friendlyFieldKey(field)]: entry.after }) : String(entry.after ?? '—');
  return (
    <div className="flex items-center gap-1.5 pl-5 text-sm">
      {Icon && <Icon className="size-3.5 shrink-0 text-muted-foreground" />}
      <span className="text-muted-foreground">{entry.label}</span>
      <span>→</span>
      <span className="truncate">{afterText}</span>
    </div>
  );
}

/** One timeline row: an icon, a lead sentence (who created/updated), and — for updates — the diff. */
function TimelineEntry({ activity, fieldByName }: { activity: Record<string, unknown>; fieldByName: Map<string, DataModelField> }) {
  const [expanded, setExpanded] = useState(false);
  const name = String(activity.name ?? '');
  const isCreated = name.startsWith('Created');
  const Icon = isCreated ? CirclePlus : Pencil;
  const actorName = (activity.createdBy as { name?: string } | null)?.name || 'Unknown';
  const diff = (activity.properties as { diff?: Record<string, FieldDiffEntry> } | null)?.diff;
  const diffEntries = diff ? Object.entries(diff) : [];

  return (
    <div className="space-y-1 rounded-md px-2 py-1.5 text-sm hover:bg-muted/40">
      <div className="flex items-center gap-1.5">
        <Icon className={cn('size-3.5 shrink-0', isCreated ? 'text-emerald-600' : 'text-muted-foreground')} />
        <span>
          {isCreated ? 'Created' : 'Updated'} by <span className="font-medium">{actorName}</span>
          {!isCreated && diffEntries.length === 1 && (
            <>
              {' — '}
              <button type="button" className="inline hover:underline" onClick={() => setExpanded((e) => !e)}>
                updated {diffEntries[0]![1].label}
              </button>
            </>
          )}
          {!isCreated && diffEntries.length > 1 && (
            <>
              {' — '}
              <button type="button" className="inline hover:underline" onClick={() => setExpanded((e) => !e)}>
                updated {diffEntries.length} fields
              </button>
            </>
          )}
        </span>
        <span className="ml-auto shrink-0 text-xs text-muted-foreground">{formatRelativeDate(activity.happensAt as string)}</span>
      </div>
      {expanded &&
        diffEntries.map(([fieldName, entry]) => <DiffLine key={fieldName} fieldByName={fieldByName} name={fieldName} entry={entry} />)}
    </div>
  );
}

/**
 * Timeline tab — a real query against `timeline_activities` filtered by the MORPH_RELATION
 * target_type/target_id pair. Rows are auto-logged on create/update by the record API
 * (`writeTimelineActivity` in record.service.ts) for Company/Person/Opportunity, with a field-level
 * before/after diff on updates (see `computeFieldDiff`).
 */
export function RecordTimelineWidget({
  sourceObjectNameSingular,
  sourceRecordId,
  fields = [],
}: {
  sourceObjectNameSingular: string;
  sourceRecordId: string;
  fields?: DataModelField[];
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
  const fieldByName = new Map(fields.map((f) => [f.name, f]));

  const groups: { month: string; items: Record<string, unknown>[] }[] = [];
  for (const activity of activities) {
    const month = format(new Date(activity.happensAt as string), 'MMMM yyyy');
    const last = groups[groups.length - 1];
    if (last?.month === month) last.items.push(activity);
    else groups.push({ month, items: [activity] });
  }

  return (
    <div className="space-y-4 py-4">
      <span className="text-sm font-medium">Timeline</span>
      {groups.map((group) => (
        <div key={group.month} className="space-y-1">
          <div className="sticky top-0 bg-background py-1 text-xs font-semibold text-muted-foreground">{group.month}</div>
          {group.items.map((activity) => (
            <TimelineEntry key={activity.id as string} activity={activity} fieldByName={fieldByName} />
          ))}
        </div>
      ))}
      {activities.length === 0 && <p className="text-xs text-muted-foreground">No activity yet.</p>}
    </div>
  );
}
