import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { recordApi } from '@/lib/api-client';

/**
 * Notes/Tasks tabs on a record's detail sheet — a two-hop widget: query the junction object
 * (note_targets/task_targets) filtered by the MORPH_RELATION target_type/target_id pair, then
 * resolve each junction row's own forward relation to the actual note/task. "+" creates a brand
 * new note/task and links it in one step; removing unlinks the junction row without deleting the
 * underlying note/task (matches "remove from this record", not "delete the note").
 */
export function RecordJunctionWidget({
  title,
  junctionObjectNamePlural,
  itemObjectNamePlural,
  itemForwardKey,
  itemLabelKey,
  sourceObjectNameSingular,
  sourceRecordId,
}: {
  title: string;
  junctionObjectNamePlural: string;
  itemObjectNamePlural: string;
  itemForwardKey: string;
  itemLabelKey: string;
  sourceObjectNameSingular: string;
  sourceRecordId: string;
}) {
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');

  const junctionsQueryKey = ['record-junctions', junctionObjectNamePlural, sourceRecordId];

  const { data: junctions } = useQuery({
    queryKey: junctionsQueryKey,
    queryFn: () =>
      recordApi.list(junctionObjectNamePlural, {
        filter: [
          { field: 'targetType', operand: 'IS', value: sourceObjectNameSingular },
          { field: 'targetId', operand: 'IS', value: sourceRecordId },
        ],
        pageSize: 100,
      }),
  });

  const junctionRows = junctions?.records ?? [];
  const itemIds = junctionRows.map((j) => j[itemForwardKey] as string | null).filter((id): id is string => !!id);

  const { data: items } = useQuery({
    queryKey: ['record-junction-items', itemObjectNamePlural, itemIds.join(',')],
    queryFn: () => Promise.all(itemIds.map((id) => recordApi.get(itemObjectNamePlural, id))),
    enabled: itemIds.length > 0,
  });

  function invalidate(): void {
    void queryClient.invalidateQueries({ queryKey: junctionsQueryKey });
  }

  const addMutation = useMutation({
    mutationFn: async (label: string) => {
      const item = await recordApi.create(itemObjectNamePlural, { [itemLabelKey]: label });
      await recordApi.create(junctionObjectNamePlural, {
        [itemForwardKey]: item.id,
        targetType: sourceObjectNameSingular,
        targetId: sourceRecordId,
      });
    },
    onSuccess: () => {
      setDraftTitle('');
      setAdding(false);
      invalidate();
    },
  });

  const removeMutation = useMutation({
    mutationFn: (junctionId: string) => recordApi.remove(junctionObjectNamePlural, junctionId),
    onSuccess: invalidate,
  });

  return (
    <div className="space-y-2 py-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{title}</span>
        <Button variant="ghost" size="sm" className="size-6 p-0" onClick={() => setAdding((a) => !a)}>
          <Plus className="size-3.5" />
        </Button>
      </div>

      {adding && (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (draftTitle.trim()) addMutation.mutate(draftTitle.trim());
          }}
        >
          <Input
            autoFocus
            placeholder={`New ${title.toLowerCase().replace(/s$/, '')}…`}
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
          />
          <Button type="submit" size="sm" disabled={addMutation.isPending}>
            Add
          </Button>
        </form>
      )}

      <div className="space-y-1.5">
        {junctionRows.map((junction) => {
          const item = items?.find((it) => it.id === junction[itemForwardKey]);
          const label = item ? String(item[itemLabelKey] ?? '(untitled)') : 'Loading…';
          return (
            <div
              key={junction.id as string}
              className="flex items-center justify-between rounded border px-2 py-1.5 text-sm"
            >
              <span className="truncate">{label}</span>
              <Button
                variant="ghost"
                size="sm"
                className="size-6 shrink-0 p-0 text-muted-foreground hover:text-destructive"
                onClick={() => removeMutation.mutate(junction.id as string)}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          );
        })}
        {junctionRows.length === 0 && (
          <p className="text-xs text-muted-foreground">No {title.toLowerCase()} yet.</p>
        )}
      </div>
    </div>
  );
}
