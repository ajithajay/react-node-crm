import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronDown, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { type DataModelField, dataModelApi, recordApi } from '@/lib/api-client';
import { resolveRecordLabel } from '../lib/field-values';
import { RecordChip } from './RecordChip';

/**
 * Search-and-select picker for a forward (MANY_TO_ONE) RELATION field — e.g. Company's Account
 * Owner, Opportunity's Company/Point of Contact. Replaces the raw-uuid text input the record form
 * used to show, matching the same search-to-link pattern already built for reverse relations
 * (RecordRelationWidget) but single-select and writing directly into the field's own value.
 */
export function RelationPickerInput({
  field,
  value,
  onChange,
}: {
  field: DataModelField;
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const targetObjectId = field.settings?.relationTargetObjectMetadataId as string | undefined;

  const { data: objects } = useQuery({ queryKey: ['data-model-objects'], queryFn: dataModelApi.listObjects });
  const targetObject = objects?.find((o) => o.id === targetObjectId);

  const { data: targetDetail } = useQuery({
    queryKey: ['data-model-object', targetObjectId],
    queryFn: () => dataModelApi.getObject(targetObjectId!),
    enabled: !!targetObjectId,
  });
  const labelField = targetDetail?.fields.find((f) => f.id === targetDetail.object.labelIdentifierFieldMetadataId);

  const { data: selectedRecord } = useQuery({
    queryKey: ['relation-picker-selected', field.id, value],
    queryFn: () => recordApi.get(targetObject!.namePlural, value!),
    enabled: !!targetObject && !!value,
  });

  const { data: candidates, isLoading } = useQuery({
    queryKey: ['relation-picker-candidates', field.id, search],
    queryFn: () => recordApi.list(targetObject!.namePlural, { search: search || undefined, pageSize: 20 }),
    enabled: open && !!targetObject,
  });

  function displayName(record: Record<string, unknown>): string {
    return resolveRecordLabel(record, labelField, targetDetail?.fields, targetObject?.labelSingular);
  }

  if (!targetObject) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button variant="outline" className="w-full justify-between font-normal" />}>
        {value ? (
          selectedRecord ? <RecordChip name={displayName(selectedRecord)} /> : '…'
        ) : (
          <span className="text-muted-foreground">Select {field.label}…</span>
        )}
        <ChevronDown className="size-3.5 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72">
        <Input autoFocus placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} className="mb-2" />
        <div className="max-h-64 space-y-0.5 overflow-y-auto">
          {value && (
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded px-1.5 py-1 text-left text-sm text-muted-foreground hover:bg-muted"
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
            >
              <X className="size-3.5" /> Clear selection
            </button>
          )}
          {isLoading && <p className="p-1 text-xs text-muted-foreground">Loading…</p>}
          {candidates?.records.map((record) => {
            const id = record.id as string;
            return (
              <button
                key={id}
                type="button"
                className="flex w-full items-center justify-between gap-2 rounded px-1.5 py-1 text-left text-sm hover:bg-muted"
                onClick={() => {
                  onChange(id);
                  setOpen(false);
                }}
              >
                <RecordChip name={displayName(record)} />
                {id === value && <Check className="size-3.5 shrink-0" />}
              </button>
            );
          })}
          {candidates?.records.length === 0 && <p className="p-1 text-xs text-muted-foreground">No matches.</p>}
        </div>
      </PopoverContent>
    </Popover>
  );
}
