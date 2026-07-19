import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { ApiError, recordApi, type DataModelField } from '@/lib/api-client';
import { formatFieldValue } from '../lib/field-values';

/** Field types the codec skips/won't accept an override for (system-managed, not user data). */
const NON_MERGEABLE_TYPES: ReadonlySet<string> = new Set(['ACTOR']);

/**
 * Field-by-field merge review: the target record (the one being viewed) survives; for every field
 * where the two records differ, the user picks which value wins. Unpicked fields keep the
 * target's own value. On confirm, relations pointing at the loser are reassigned to the target and
 * the loser is soft-deleted (see apps/api/src/modules/record/merge.service.ts).
 */
export function MergeRecordsDialog({
  objectNamePlural,
  targetRecordId,
  loserRecordId,
  fields,
  onClose,
}: {
  objectNamePlural: string;
  targetRecordId: string;
  loserRecordId: string;
  fields: DataModelField[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<Record<string, string>>({});

  const { data: target } = useQuery({
    queryKey: ['record', objectNamePlural, targetRecordId],
    queryFn: () => recordApi.get(objectNamePlural, targetRecordId),
  });
  const { data: loser } = useQuery({
    queryKey: ['record', objectNamePlural, loserRecordId],
    queryFn: () => recordApi.get(objectNamePlural, loserRecordId),
  });

  const comparableFields = useMemo(
    () => fields.filter((f) => !NON_MERGEABLE_TYPES.has(f.type) && f.type !== 'RELATION' && f.isActive),
    [fields],
  );

  const mergeMutation = useMutation({
    mutationFn: () =>
      recordApi.merge(objectNamePlural, {
        targetRecordId,
        loserRecordIds: [loserRecordId],
        fieldOverrides: overrides,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['record', objectNamePlural, targetRecordId] });
      void queryClient.invalidateQueries({ queryKey: ['record-duplicates', objectNamePlural, targetRecordId] });
      void queryClient.invalidateQueries({ queryKey: [objectNamePlural] });
      onClose();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Something went wrong'),
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Merge records</DialogTitle>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {!target || !loser ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="max-h-[60vh] space-y-1 overflow-y-auto">
            <p className="mb-2 text-sm text-muted-foreground">
              This record will be kept. Pick which value wins for any field that differs — everything else keeps
              this record's current value. The other record will be deleted and any of its relations moved over.
            </p>
            {comparableFields.map((field) => {
              const targetValue = formatFieldValue(field, target);
              const loserValue = formatFieldValue(field, loser);
              if (targetValue === loserValue) return null;

              const chosen = overrides[field.id] ?? targetRecordId;
              return (
                <div key={field.id} className="grid grid-cols-[100px_1fr_1fr] items-center gap-2 py-1.5 text-sm">
                  <span className="truncate text-xs font-medium text-muted-foreground">{field.label}</span>
                  <OptionButton
                    selected={chosen === targetRecordId}
                    value={targetValue}
                    onClick={() => setOverrides((o) => ({ ...o, [field.id]: targetRecordId }))}
                  />
                  <OptionButton
                    selected={chosen === loserRecordId}
                    value={loserValue}
                    onClick={() => setOverrides((o) => ({ ...o, [field.id]: loserRecordId }))}
                  />
                </div>
              );
            })}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => mergeMutation.mutate()} disabled={!target || !loser || mergeMutation.isPending}>
            Merge
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function OptionButton({ selected, value, onClick }: { selected: boolean; value: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 truncate rounded-md border px-2 py-1 text-left',
        selected ? 'border-primary bg-primary/10' : 'border-transparent hover:bg-muted',
      )}
    >
      {selected && <Check className="size-3 shrink-0 text-primary" />}
      <span className="truncate">{value}</span>
    </button>
  );
}
