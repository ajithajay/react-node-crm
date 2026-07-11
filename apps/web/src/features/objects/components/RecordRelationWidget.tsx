import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { type DataModelField, dataModelApi, recordApi } from '@/lib/api-client';
import { toCamelCase } from '@saasly/shared';
import { formatFieldValue } from '../lib/field-values';
import { RecordChip } from './RecordChip';

/**
 * A reverse (ONE_TO_MANY) relation shown as a linked-records widget with a search-to-link picker —
 * matches Twenty's "People"/"Opportunities" relation sections on a record's Home tab. Only handles
 * genuine FK-backed reverse relations (People/Opportunities-style); morph reverses (Notes/Tasks/
 * Attachments/Timeline Activities) aren't resolvable this way — see the Timeline/Notes/Tasks/Files
 * tab placeholders, which cover those instead.
 */
export function RecordRelationWidget({ field, sourceRecordId }: { field: DataModelField; sourceRecordId: string }) {
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

  return (
    <div className="border-t pt-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium">{field.label}</span>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          {linked?.total ?? 0}
          <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
            <PopoverTrigger render={<Button variant="ghost" size="sm" className="size-6 p-0" />}>
              <Plus className="size-3.5" />
            </PopoverTrigger>
            <PopoverContent align="end" className="w-64">
              <Input
                autoFocus
                placeholder="Search…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="mb-2"
              />
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
                {candidates?.records.length === 0 && (
                  <p className="p-1 text-xs text-muted-foreground">No matches.</p>
                )}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>
      <div className="space-y-1.5">
        {linkedRecords.map((record) => (
          <div key={record.id as string}>
            <RecordChip name={displayName(record)} />
          </div>
        ))}
        {linkedRecords.length === 0 && (
          <p className="text-xs text-muted-foreground">No {field.label.toLowerCase()} yet.</p>
        )}
      </div>
    </div>
  );
}
