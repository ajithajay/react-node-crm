import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { type DataModelField, dataModelApi, recordApi } from '@/lib/api-client';
import { toCamelCase } from '@saasly/shared';
import { cn } from '@/lib/utils';
import { formatFieldValue } from '../lib/field-values';
import { RecordChip } from './RecordChip';

type RelationDisplayMode = 'PLAIN' | 'CARD' | 'TABLE';

/**
 * A reverse (ONE_TO_MANY) relation shown as a linked-records widget (Twenty's People/Opportunities
 * sections). Each linked record is a chip that navigates to that record's own page, with a detach
 * (unlink) control that nulls the FK — it does not delete the record. `displayMode` mirrors Twenty's
 * FIELD-widget layouts: Field (compact inline chips), Card (bordered rows), Table (a mini list).
 */
export function RecordRelationWidget({
  field,
  sourceRecordId,
  displayMode = 'CARD',
}: {
  field: DataModelField;
  sourceRecordId: string;
  displayMode?: RelationDisplayMode;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState('');

  const targetObjectId = field.settings?.relationTargetObjectMetadataId as string | undefined;
  const targetForwardName = field.settings?.relationTargetFieldName as string | undefined;
  const targetForwardKey = targetForwardName ? `${toCamelCase(targetForwardName)}Id` : undefined;

  const { data: objects } = useQuery({ queryKey: ['data-model-objects'], queryFn: dataModelApi.listObjects });
  const targetObject = objects?.find((o) => o.id === targetObjectId);

  const { data: targetDetail } = useQuery({
    queryKey: ['data-model-object', targetObjectId],
    queryFn: () => dataModelApi.getObject(targetObjectId!),
    enabled: !!targetObjectId,
  });
  const labelField = targetDetail?.fields.find((f) => f.id === targetDetail.object.labelIdentifierFieldMetadataId);

  const enabled = !!targetObject && !!targetForwardKey;

  const { data: linked, refetch } = useQuery({
    queryKey: ['relation-linked', field.id, sourceRecordId],
    queryFn: () =>
      recordApi.list(targetObject!.namePlural, {
        filter: [{ field: targetForwardKey!, operand: 'IS', value: sourceRecordId }],
        pageSize: 50,
      }),
    enabled,
  });

  const { data: candidates } = useQuery({
    queryKey: ['relation-candidates', field.id, search],
    queryFn: () => recordApi.list(targetObject!.namePlural, { search: search || undefined, pageSize: 20 }),
    enabled: enabled && pickerOpen,
  });

  if (!enabled) return null;

  const linkedRecords = linked?.records ?? [];
  const linkedIds = new Set(linkedRecords.map((r) => r.id as string));

  async function toggleLink(candidateId: string, link: boolean): Promise<void> {
    await recordApi.update(targetObject!.namePlural, candidateId, { [targetForwardKey!]: link ? sourceRecordId : null });
    void refetch();
  }

  function displayName(record: Record<string, unknown>): string {
    if (!labelField) return String(record.id ?? '—');
    const formatted = formatFieldValue(labelField, record);
    return formatted === '—' ? String(record.id ?? '—') : formatted;
  }

  function hrefFor(id: string): string {
    return `/objects/${targetObject!.namePlural}/${id}`;
  }

  function LinkedChip({ record }: { record: Record<string, unknown> }): React.ReactElement {
    const id = record.id as string;
    return (
      <div className="group/link flex min-w-0 items-center gap-1">
        <Link to={hrefFor(id)} className="min-w-0 hover:underline">
          <RecordChip name={displayName(record)} />
        </Link>
        <button
          type="button"
          aria-label="Detach"
          onClick={() => void toggleLink(id, false)}
          className="shrink-0 rounded p-0.5 text-muted-foreground opacity-0 hover:text-destructive group-hover/link:opacity-100"
        >
          <X className="size-3" />
        </button>
      </div>
    );
  }

  const addPicker = (
    <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
      <PopoverTrigger render={<Button variant="ghost" size="sm" className="size-6 p-0" />}>
        <Plus className="size-3.5" />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64">
        <Input autoFocus placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} className="mb-2" />
        <div className="max-h-64 space-y-1 overflow-y-auto">
          {candidates?.records.map((record) => {
            const id = record.id as string;
            return (
              <label key={id} className="flex items-center gap-2 rounded px-1 py-1 text-sm hover:bg-muted">
                <Checkbox checked={linkedIds.has(id)} onCheckedChange={(c) => void toggleLink(id, c === true)} />
                <RecordChip name={displayName(record)} />
              </label>
            );
          })}
          {candidates?.records.length === 0 && <p className="p-1 text-xs text-muted-foreground">No matches.</p>}
        </div>
      </PopoverContent>
    </Popover>
  );

  return (
    <div className="border-t pt-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium">{field.label}</span>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          {linked?.total ?? 0}
          {addPicker}
        </div>
      </div>

      {linkedRecords.length === 0 ? (
        <p className="text-xs text-muted-foreground">No {field.label.toLowerCase()} yet.</p>
      ) : displayMode === 'PLAIN' ? (
        <div className="flex flex-wrap gap-x-3 gap-y-1.5">
          {linkedRecords.map((record) => (
            <LinkedChip key={record.id as string} record={record} />
          ))}
        </div>
      ) : displayMode === 'TABLE' ? (
        <div className="divide-y rounded-md border">
          {linkedRecords.map((record) => (
            <div key={record.id as string} className="px-2 py-1.5">
              <LinkedChip record={record} />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-1.5">
          {linkedRecords.map((record) => (
            <div key={record.id as string} className={cn('rounded-md border px-2.5 py-1.5')}>
              <LinkedChip record={record} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
