import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { recordApi, type DataModelField } from '@/lib/api-client';
import { MergeRecordsDialog } from './MergeRecordsDialog';

/**
 * Fixed (non-customizable) section — mirrors Twenty's "Duplicates" section: surfaces other
 * records matching this one on the object's configured `duplicateCriteria`, with a one-click path
 * into the merge tool. Renders nothing if the object has no criteria configured or none match —
 * this is deliberately not a widget the layout customizer can remove, same as `RecordTargetsWidget`.
 */
export function RecordDuplicatesWidget({
  objectNamePlural,
  recordId,
  fields,
}: {
  objectNamePlural: string;
  recordId: string;
  fields: DataModelField[];
}) {
  const [mergeWithId, setMergeWithId] = useState<string | null>(null);

  const { data: matches } = useQuery({
    queryKey: ['record-duplicates', objectNamePlural, recordId],
    queryFn: () => recordApi.duplicates(objectNamePlural, recordId),
  });

  if (!matches || matches.length === 0) return null;

  return (
    <>
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
        <div className="mb-2 flex items-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-400">
          <Copy className="size-4" />
          Possible Duplicates
        </div>
        <div className="space-y-1.5">
          {matches.map((match) => (
            <div key={match.recordId} className="flex items-center justify-between gap-2 text-sm">
              <span className="truncate">{match.label}</span>
              <Button variant="outline" size="sm" className="h-7 shrink-0" onClick={() => setMergeWithId(match.recordId)}>
                Merge
              </Button>
            </div>
          ))}
        </div>
      </div>

      {mergeWithId && (
        <MergeRecordsDialog
          objectNamePlural={objectNamePlural}
          targetRecordId={recordId}
          loserRecordId={mergeWithId}
          fields={fields}
          onClose={() => setMergeWithId(null)}
        />
      )}
    </>
  );
}
