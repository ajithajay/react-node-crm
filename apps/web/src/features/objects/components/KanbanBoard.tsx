import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { type DataModelField, recordApi } from '@/lib/api-client';
import type { FilterCondition } from './FilterBar';
import { RecordChip } from './RecordChip';
import { formatFieldValue, friendlyFieldKey } from '../lib/field-values';
import { tagColor } from '../lib/table-tokens';

const NO_VALUE = '__no_value__';
/** recordListQuerySchema caps pageSize at 200 — the board loads one page and doesn't paginate
 * further, so boards with more than 200 matching records won't show everything (documented v1 cap). */
const BOARD_PAGE_SIZE = 200;

/**
 * BRD: "Kanban view (grouped by a Select field)". Columns = the group-by field's configured options
 * (plus a "No value" column), cards = the label-identifier chip. Drag-and-drop uses plain HTML5 DnD
 * (no dnd-kit/similar library) — enough for single-card column moves; reordering within a column and
 * multi-select drag aren't supported, a deliberate v1 scope cut (see task-list.md).
 */
export function KanbanBoard({
  objectNamePlural,
  labelIdentifierField,
  groupByField,
  cardFields,
  search,
  filters,
  onOpenRecord,
  onCreateInColumn,
}: {
  objectNamePlural: string;
  labelIdentifierField: DataModelField | undefined;
  groupByField: DataModelField;
  cardFields: DataModelField[];
  search: string;
  filters: FilterCondition[];
  onOpenRecord: (record: Record<string, unknown>) => void;
  onCreateInColumn: (columnValue: string | null) => void;
}) {
  const queryClient = useQueryClient();
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const groupKey = friendlyFieldKey(groupByField);
  const options = (groupByField.settings?.options as { value: string; label: string; color: string }[] | undefined) ?? [];

  const { data, isLoading } = useQuery({
    queryKey: ['records', objectNamePlural, 'kanban', search, filters],
    queryFn: () =>
      recordApi.list(objectNamePlural, {
        page: 1,
        pageSize: BOARD_PAGE_SIZE,
        search: search || undefined,
        filter: filters.filter((f) => f.field && f.operand),
      }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, value }: { id: string; value: string | null }) =>
      recordApi.update(objectNamePlural, id, { [groupKey]: value }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['records', objectNamePlural, 'kanban'] }),
  });

  const records = data?.records ?? [];
  const columns = [...options.map((o) => ({ value: o.value, label: o.label, color: o.color })), { value: NO_VALUE, label: 'No value', color: 'gray' }];

  function recordsFor(columnValue: string): Record<string, unknown>[] {
    return records.filter((r) => (columnValue === NO_VALUE ? r[groupKey] == null : r[groupKey] === columnValue));
  }

  function labelFor(record: Record<string, unknown>): string {
    if (!labelIdentifierField) return String(record.id);
    const key = friendlyFieldKey(labelIdentifierField);
    const value = record[key];
    if (value && typeof value === 'object') {
      const v = value as Record<string, unknown>;
      return `${v.firstName ?? ''} ${v.lastName ?? ''}`.trim() || String(record.id);
    }
    return String(value ?? record.id);
  }

  function handleDrop(columnValue: string): void {
    const id = window.__kanbanDragRecordId;
    if (!id) return;
    updateMutation.mutate({ id, value: columnValue === NO_VALUE ? null : columnValue });
    setDragOverColumn(null);
  }

  if (isLoading) return <p className="p-4 text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="flex h-full gap-3 overflow-x-auto p-3">
      {columns.map((column) => {
        const columnRecords = recordsFor(column.value);
        const { text } = tagColor(column.color);
        return (
          <div
            key={column.value}
            className={`flex w-72 shrink-0 flex-col rounded-md border bg-muted/20 ${dragOverColumn === column.value ? 'ring-2 ring-primary' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOverColumn(column.value);
            }}
            onDragLeave={() => setDragOverColumn(null)}
            onDrop={() => handleDrop(column.value)}
          >
            <div className="flex items-center justify-between border-b px-2 py-2">
              <span className="inline-flex items-center gap-1.5 text-sm font-medium" style={{ color: text }}>
                {column.label}
                <span className="text-xs font-normal text-muted-foreground">{columnRecords.length}</span>
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="size-6 p-0"
                onClick={() => onCreateInColumn(column.value === NO_VALUE ? null : column.value)}
              >
                <Plus className="size-3.5" />
              </Button>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto p-2">
              {columnRecords.map((record) => (
                <div
                  key={record.id as string}
                  draggable
                  onDragStart={() => {
                    window.__kanbanDragRecordId = record.id as string;
                  }}
                  onClick={() => onOpenRecord(record)}
                  className="cursor-pointer rounded-md border bg-background p-2 text-sm shadow-sm hover:border-primary/50"
                >
                  <RecordChip name={labelFor(record)} />
                  {cardFields.length > 0 && (
                    <div className="mt-1.5 space-y-1 text-xs text-muted-foreground">
                      {cardFields.map((f) => {
                        const formatted = formatFieldValue(f, record);
                        if (formatted === '—') return null;
                        return (
                          <div key={f.id} className="flex items-center gap-1 truncate">
                            <span className="shrink-0">{f.label}:</span>
                            <span className="truncate text-foreground">{formatted}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
              {columnRecords.length === 0 && <p className="text-xs text-muted-foreground">No records.</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// A plain global for the dragged record id — HTML5 DnD's dataTransfer isn't readable on dragover in
// all browsers without extra ceremony; this is simpler and fine for a same-page, same-tab drag.
declare global {
  interface Window {
    __kanbanDragRecordId?: string;
  }
}
