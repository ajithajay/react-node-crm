import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { dataModelApi, recordApi } from '@/lib/api-client';
import { friendlyFieldKey } from '../lib/field-values';
import { RecordSheet } from './RecordSheet';

/**
 * Notes/Tasks tabs on a record's detail sheet — a two-hop widget: query the junction object
 * (note_targets/task_targets) by the MORPH_RELATION target_type/target_id pair, then resolve each
 * junction row's forward relation to the actual note/task. Matching Twenty: "Create" opens the full
 * note/task record in a side sheet (rich body + all fields) with this record pre-attached; tasks get
 * a mark-as-done checkbox; removing a row unlinks the junction without deleting the note/task.
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
  const [createOpen, setCreateOpen] = useState(false);
  const [editItem, setEditItem] = useState<Record<string, unknown> | null>(null);

  const { data: objects } = useQuery({ queryKey: ['data-model-objects'], queryFn: dataModelApi.listObjects });
  const itemObject = objects?.find((o) => o.namePlural === itemObjectNamePlural);
  const { data: itemDetail } = useQuery({
    queryKey: ['data-model-object', itemObject?.id],
    queryFn: () => dataModelApi.getObject(itemObject!.id),
    enabled: !!itemObject,
  });
  const itemFields = itemDetail?.fields ?? [];
  const statusField = itemFields.find((f) => f.name === 'status');
  const labelField = itemDetail
    ? itemFields.find((f) => f.id === itemDetail.object.labelIdentifierFieldMetadataId)
    : undefined;

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

  const itemsQueryKey = ['record-junction-items', itemObjectNamePlural, itemIds.join(',')];
  const { data: items } = useQuery({
    queryKey: itemsQueryKey,
    queryFn: () => Promise.all(itemIds.map((id) => recordApi.get(itemObjectNamePlural, id))),
    enabled: itemIds.length > 0,
  });

  function invalidate(): void {
    void queryClient.invalidateQueries({ queryKey: junctionsQueryKey });
    void queryClient.invalidateQueries({ queryKey: ['record-junction-items', itemObjectNamePlural] });
  }

  async function createItemAndLink(body: Record<string, unknown>): Promise<unknown> {
    const item = await recordApi.create(itemObjectNamePlural, body);
    await recordApi.create(junctionObjectNamePlural, {
      [itemForwardKey]: item.id,
      targetType: sourceObjectNameSingular,
      targetId: sourceRecordId,
    });
    invalidate();
    return item;
  }

  const updateItem = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      recordApi.update(itemObjectNamePlural, id, body),
    onSuccess: invalidate,
  });

  const removeMutation = useMutation({
    mutationFn: (junctionId: string) => recordApi.remove(junctionObjectNamePlural, junctionId),
    onSuccess: invalidate,
  });

  const statusKey = statusField ? friendlyFieldKey(statusField) : undefined;

  return (
    <div className="space-y-2 py-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{title}</span>
        <Button variant="ghost" size="sm" className="size-6 p-0" onClick={() => setCreateOpen(true)}>
          <Plus className="size-3.5" />
        </Button>
      </div>

      <div className="space-y-1.5">
        {junctionRows.map((junction) => {
          const item = items?.find((it) => it.id === junction[itemForwardKey]);
          const label = item ? String(item[itemLabelKey] ?? '(untitled)') : 'Loading…';
          const done = !!(statusKey && item && item[statusKey] === 'DONE');
          return (
            <div
              key={junction.id as string}
              className="flex items-center gap-2 rounded border px-2 py-1.5 text-sm hover:bg-muted/40"
            >
              {statusField && item && (
                <Checkbox
                  checked={done}
                  onClick={(e) => e.stopPropagation()}
                  onCheckedChange={() =>
                    updateItem.mutate({ id: item.id as string, body: { [statusKey!]: done ? 'TODO' : 'DONE' } })
                  }
                />
              )}
              <button
                type="button"
                className={cn('flex-1 truncate text-left', done && 'text-muted-foreground line-through')}
                onClick={() => item && setEditItem(item)}
              >
                {label}
              </button>
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
        {junctionRows.length === 0 && <p className="text-xs text-muted-foreground">No {title.toLowerCase()} yet.</p>}
      </div>

      {itemObject && (
        <RecordSheet
          key={`create-${createOpen}`}
          open={createOpen}
          onOpenChange={setCreateOpen}
          mode="create"
          objectLabel={itemObject.labelSingular}
          objectNameSingular={itemObject.nameSingular}
          objectMetadataId={itemObject.id}
          fields={itemFields}
          labelIdentifierField={labelField}
          onSubmit={createItemAndLink}
        />
      )}

      {itemObject && editItem && (
        <RecordSheet
          key={editItem.id as string}
          open={!!editItem}
          onOpenChange={(o) => !o && setEditItem(null)}
          mode="edit"
          objectLabel={itemObject.labelSingular}
          objectNameSingular={itemObject.nameSingular}
          objectMetadataId={itemObject.id}
          fields={itemFields}
          labelIdentifierField={labelField}
          initialValues={editItem}
          onSubmit={(body) => updateItem.mutateAsync({ id: editItem.id as string, body })}
        />
      )}
    </div>
  );
}
