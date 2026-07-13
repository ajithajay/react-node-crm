import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { Check, ChevronDown, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { type DataModelField, dataModelApi, recordApi } from '@/lib/api-client';
import { resolveRecordLabel } from '../lib/field-values';
import { RecordChip } from './RecordChip';

/**
 * Search-and-select picker for a forward (MANY_TO_ONE) RELATION field — e.g. Company's Account
 * Owner, Opportunity's Company/Point of Contact. When `linkRecords` is set (record-page context),
 * the selected chip links to the target record's own page and a detach control clears the link.
 */
export function RelationPickerInput({
  field,
  value,
  onChange,
  linkRecords = false,
}: {
  field: DataModelField;
  value: string | null;
  onChange: (value: string | null) => void;
  /** Record-page mode: chip navigates to the target record + a detach (x) control is shown. */
  linkRecords?: boolean;
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

  const targetHref = value ? `/objects/${targetObject.namePlural}/${value}` : '#';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        nativeButton={false}
        render={
          <div
            role="button"
            tabIndex={0}
            className="group/rel flex min-h-9 w-full cursor-pointer items-center justify-between gap-1 rounded-md border bg-transparent px-3 py-1 text-sm font-normal hover:bg-muted/50"
          />
        }
      >
        {value ? (
          <span className="flex min-w-0 items-center gap-1">
            {linkRecords && selectedRecord ? (
              <Link to={targetHref} onClick={(e) => e.stopPropagation()} className="min-w-0 hover:underline">
                <RecordChip name={selectedRecord ? displayName(selectedRecord) : '…'} />
              </Link>
            ) : selectedRecord ? (
              <RecordChip name={displayName(selectedRecord)} />
            ) : (
              '…'
            )}
          </span>
        ) : (
          <span className="text-muted-foreground">Select {field.label}…</span>
        )}
        {value ? (
          <button
            type="button"
            aria-label="Detach"
            onClick={(e) => {
              e.stopPropagation();
              onChange(null);
            }}
            className="shrink-0 rounded p-0.5 text-muted-foreground opacity-0 hover:text-destructive group-hover/rel:opacity-100"
          >
            <X className="size-3.5" />
          </button>
        ) : (
          <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
        )}
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
