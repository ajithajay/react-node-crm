import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { ChevronDown, MoreVertical, Plus, Trash2, Unlink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { type DataModelField, dataModelApi, recordApi } from '@/lib/api-client';
import { toCamelCase } from '@saasly/shared';
import { cn } from '@/lib/utils';
import { formatFieldValue } from '../lib/field-values';
import { RecordChip } from './RecordChip';
import { RecordField } from './RecordFieldRows';

type RelationDisplayMode = 'PLAIN' | 'CARD' | 'TABLE';

/** Only ever show 5 linked records inline — "All (N)" links out beyond that; we just
 * note the overflow count instead of building a filtered-index link-out for this pass. */
const MAX_VISIBLE = 5;

/**
 * A reverse (ONE_TO_MANY) relation shown as a linked-records widget (e.g. People/Opportunities
 * sections). Each linked record is a chip that navigates to that record's own page. In CARD mode, a
 * chevron expands one record at a time (accordion) to show essentially all of its other fields — the
 * same `RecordField` renderer the record's own page uses — and a "⋮" menu offers Detach (clears the
 * FK, keeps the record) or Delete (removes the linked record itself).
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
  const [expandedId, setExpandedId] = useState<string | null>(null);

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

  // Fields shown when a linked record is expanded: everything except the label (already the chip),
  // the back-reference relation itself (avoid a circular field), and any reverse/morph relation
  // (avoid nested relation widgets inside the accordion).
  const expandableFields = (targetDetail?.fields ?? []).filter(
    (f) =>
      f.id !== labelField?.id &&
      f.name !== targetForwardName &&
      f.type !== 'MORPH_RELATION' &&
      !(f.type === 'RELATION' && f.settings?.relationType === 'ONE_TO_MANY'),
  );

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

  const allLinkedRecords = linked?.records ?? [];
  const linkedRecords = allLinkedRecords.slice(0, MAX_VISIBLE);
  const overflow = allLinkedRecords.length - linkedRecords.length;
  const linkedIds = new Set(allLinkedRecords.map((r) => r.id as string));

  async function toggleLink(candidateId: string, link: boolean): Promise<void> {
    await recordApi.update(targetObject!.namePlural, candidateId, { [targetForwardKey!]: link ? sourceRecordId : null });
    void refetch();
  }

  async function deleteLinked(id: string): Promise<void> {
    if (!window.confirm('Delete this record? This cannot be undone.')) return;
    await recordApi.remove(targetObject!.namePlural, id);
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

  function LinkedRow({ record, expandable }: { record: Record<string, unknown>; expandable: boolean }): React.ReactElement {
    const id = record.id as string;
    const isExpanded = expandedId === id;
    return (
      <div className={cn('rounded-md border', expandable && 'overflow-hidden')}>
        <div className="group/link flex min-w-0 items-center gap-1 px-2.5 py-1.5">
          {expandable && (
            <button
              type="button"
              aria-label={isExpanded ? 'Collapse' : 'Expand'}
              onClick={() => setExpandedId(isExpanded ? null : id)}
              className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground"
            >
              <ChevronDown className={cn('size-3.5 transition-transform', !isExpanded && '-rotate-90')} />
            </button>
          )}
          <Link to={hrefFor(id)} className="min-w-0 flex-1 hover:underline">
            <RecordChip name={displayName(record)} />
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  type="button"
                  aria-label="Actions"
                  className="shrink-0 rounded p-0.5 text-muted-foreground opacity-0 hover:text-foreground group-hover/link:opacity-100 data-open:opacity-100"
                />
              }
            >
              <MoreVertical className="size-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => void toggleLink(id, false)}>
                <Unlink className="size-3.5" /> Detach
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onClick={() => void deleteLinked(id)}>
                <Trash2 className="size-3.5" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {expandable && isExpanded && (
          <div className="space-y-2 border-t bg-muted/20 px-2.5 py-2">
            {expandableFields.map((f) => (
              <RecordField
                key={f.id}
                field={f}
                objectNamePlural={targetObject!.namePlural}
                recordId={id}
                record={record}
                variant="row"
              />
            ))}
          </div>
        )}
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
      ) : (
        <div className="space-y-1.5">
          {linkedRecords.map((record) => (
            <LinkedRow key={record.id as string} record={record} expandable={displayMode !== 'PLAIN'} />
          ))}
          {overflow > 0 && <p className="px-1 text-xs text-muted-foreground">+{overflow} more</p>}
        </div>
      )}
    </div>
  );
}
