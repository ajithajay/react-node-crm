import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { type DataModelField, dataModelApi, recordApi, viewApi } from '@/lib/api-client';
import { getIcon } from '@/lib/icons';
import type { CreateViewInput } from '../components/CreateViewDialog';
import type { FilterCondition } from '../components/FilterBar';
import { KanbanBoard } from '../components/KanbanBoard';
import { RecordSheet } from '../components/RecordSheet';
import { RecordTableCellDisplay } from '../components/RecordTableCellDisplay';
import { RecordTableToolbar } from '../components/RecordTableToolbar';
import { friendlyFieldKey } from '../lib/field-values';
import {
  conditionsToViewFilters,
  localSortToViewSorts,
  stateSignature,
  viewFiltersToConditions,
  viewSortToLocal,
} from '../lib/view-mapping';
import { FIELD_TYPE_ICON, TABLE_ROW_HEIGHT } from '../lib/table-tokens';

const PAGE_SIZE = 25;

export function ObjectRecordsPage({ objectNamePlural }: { objectNamePlural: string }) {
  const queryClient = useQueryClient();
  const [loadedPages, setLoadedPages] = useState(1);
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<string | undefined>(undefined);
  const [sortDirection, setSortDirection] = useState<'ASC' | 'DESC'>('ASC');
  const [filters, setFilters] = useState<FilterCondition[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [createOpen, setCreateOpen] = useState(false);
  const [createInitialValues, setCreateInitialValues] = useState<Record<string, unknown> | undefined>(undefined);
  const [editRecord, setEditRecord] = useState<Record<string, unknown> | null>(null);
  const [activeViewId, setActiveViewId] = useState<string | undefined>(undefined);

  useEffect(() => {
    setLoadedPages(1);
    setSelected(new Set());
  }, [search, sortField, sortDirection, filters]);

  const { data: objects } = useQuery({ queryKey: ['data-model-objects'], queryFn: dataModelApi.listObjects });
  const object = objects?.find((o) => o.namePlural === objectNamePlural);

  const { data: detail } = useQuery({
    queryKey: ['data-model-object', object?.id],
    queryFn: () => dataModelApi.getObject(object!.id),
    enabled: !!object,
  });

  const { data: views } = useQuery({
    queryKey: ['views', object?.id],
    queryFn: () => viewApi.list(object!.id),
    enabled: !!object,
  });
  const currentViewId = activeViewId ?? views?.[0]?.id;
  const activeView = views?.find((v) => v.id === currentViewId);

  const { data: viewDetail } = useQuery({
    queryKey: ['view', currentViewId],
    queryFn: () => viewApi.get(currentViewId!),
    enabled: !!currentViewId,
  });

  const fieldsById = useMemo(() => new Map((detail?.fields ?? []).map((f) => [f.id, f])), [detail]);
  const fieldByKey = useMemo(
    () => new Map((detail?.fields ?? []).map((f) => [friendlyFieldKey(f), f])),
    [detail],
  );

  // Load a view's persisted filters/sorts into local state when the active view changes (gap B1).
  // Keyed on the loaded view id via a ref so a post-save refetch (same id) never clobbers state.
  const loadedViewRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!viewDetail || fieldsById.size === 0) return;
    if (loadedViewRef.current === viewDetail.id) return;
    loadedViewRef.current = viewDetail.id;
    setFilters(viewFiltersToConditions(viewDetail, fieldsById));
    const sort = viewSortToLocal(viewDetail, fieldsById);
    setSortField(sort.field);
    setSortDirection(sort.direction);
  }, [viewDetail, fieldsById]);

  const isViewDirty = useMemo(() => {
    if (!viewDetail || fieldsById.size === 0) return false;
    const persisted = viewFiltersToConditions(viewDetail, fieldsById);
    const persistedSort = viewSortToLocal(viewDetail, fieldsById);
    return (
      stateSignature(filters, sortField, sortDirection) !==
      stateSignature(persisted, persistedSort.field, persistedSort.direction)
    );
  }, [viewDetail, fieldsById, filters, sortField, sortDirection]);

  const columns: DataModelField[] = useMemo(() => {
    if (!viewDetail) return [];
    return viewDetail.fields
      .filter((f) => f.isVisible)
      .sort((a, b) => a.position - b.position)
      .map((f) => fieldsById.get(f.fieldMetadataId))
      .filter((f): f is DataModelField => !!f);
  }, [viewDetail, fieldsById]);

  const { data: listResult, isLoading } = useQuery({
    queryKey: ['records', objectNamePlural, loadedPages, search, sortField, sortDirection, filters],
    queryFn: () =>
      recordApi.list(objectNamePlural, {
        page: 1,
        pageSize: PAGE_SIZE * loadedPages,
        search: search || undefined,
        sortField,
        sortDirection,
        filter: filters.filter((f) => f.field && f.operand),
      }),
    enabled: !!detail,
  });

  const invalidateRecords = () => void queryClient.invalidateQueries({ queryKey: ['records', objectNamePlural] });

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => recordApi.create(objectNamePlural, body),
    onSuccess: invalidateRecords,
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      recordApi.update(objectNamePlural, id, body),
    onSuccess: invalidateRecords,
  });
  const setFieldsMutation = useMutation({
    mutationFn: (fieldsInput: { fieldMetadataId: string; isVisible: boolean; size: number }[]) =>
      viewApi.setFields(currentViewId!, fieldsInput),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['view', currentViewId] }),
  });
  const createViewMutation = useMutation({
    mutationFn: async (input: CreateViewInput) => {
      const view = await viewApi.create({ objectMetadataId: object!.id, name: input.name, type: input.type });
      if (input.groupByFieldMetadataId) {
        await viewApi.update(view.id, { kanbanFieldMetadataId: input.groupByFieldMetadataId });
      }
      return view;
    },
    onSuccess: (view) => {
      void queryClient.invalidateQueries({ queryKey: ['views', object?.id] });
      setActiveViewId(view.id);
    },
  });

  const invalidateViews = () => void queryClient.invalidateQueries({ queryKey: ['views', object?.id] });

  // Persist the current in-memory filters/sorts onto the active view (gap B1).
  const saveViewMutation = useMutation({
    mutationFn: async () => {
      await viewApi.setFilters(currentViewId!, conditionsToViewFilters(filters, fieldByKey));
      await viewApi.setSorts(currentViewId!, localSortToViewSorts(sortField, sortDirection, fieldByKey));
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['view', currentViewId] }),
  });

  // "Save as new view": create a view carrying the current filters/sorts/columns, then switch to it.
  const saveAsNewViewMutation = useMutation({
    mutationFn: async (name: string) => {
      const view = await viewApi.create({ objectMetadataId: object!.id, name, type: activeView?.type ?? 'TABLE' });
      await viewApi.setFilters(view.id, conditionsToViewFilters(filters, fieldByKey));
      await viewApi.setSorts(view.id, localSortToViewSorts(sortField, sortDirection, fieldByKey));
      if (viewDetail) {
        await viewApi.setFields(
          view.id,
          viewDetail.fields.map((f) => ({ fieldMetadataId: f.fieldMetadataId, isVisible: f.isVisible, size: f.size })),
        );
      }
      return view;
    },
    onSuccess: (view) => {
      invalidateViews();
      setActiveViewId(view.id);
    },
  });

  const renameViewMutation = useMutation({
    mutationFn: (name: string) => viewApi.update(currentViewId!, { name }),
    onSuccess: () => {
      invalidateViews();
      void queryClient.invalidateQueries({ queryKey: ['view', currentViewId] });
    },
  });

  const duplicateViewMutation = useMutation({
    mutationFn: async () => {
      const view = await viewApi.create({
        objectMetadataId: object!.id,
        name: `${activeView?.name ?? 'View'} copy`,
        type: activeView?.type ?? 'TABLE',
      });
      if (activeView?.kanbanFieldMetadataId) {
        await viewApi.update(view.id, { kanbanFieldMetadataId: activeView.kanbanFieldMetadataId });
      }
      if (viewDetail) {
        await viewApi.setFields(
          view.id,
          viewDetail.fields.map((f) => ({ fieldMetadataId: f.fieldMetadataId, isVisible: f.isVisible, size: f.size })),
        );
        await viewApi.setFilters(
          view.id,
          viewDetail.filters.map((f) => ({ fieldMetadataId: f.fieldMetadataId, operand: f.operand, value: f.value })),
        );
        await viewApi.setSorts(view.id, viewDetail.sorts.map((s) => ({ fieldMetadataId: s.fieldMetadataId, direction: s.direction })));
      }
      return view;
    },
    onSuccess: (view) => {
      invalidateViews();
      setActiveViewId(view.id);
    },
  });

  const deleteViewMutation = useMutation({
    mutationFn: () => viewApi.remove(currentViewId!),
    onSuccess: () => {
      invalidateViews();
      setActiveViewId(views?.find((v) => v.id !== currentViewId)?.id);
    },
  });

  function openCreate(initialValues?: Record<string, unknown>): void {
    setCreateInitialValues(initialValues);
    setCreateOpen(true);
  }

  async function handleExport(): Promise<void> {
    const { blob, filename } = await recordApi.exportCsv(objectNamePlural, {
      search: search || undefined,
      sortField,
      sortDirection,
      filter: filters.filter((f) => f.field && f.operand),
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImport(file: File) {
    const summary = await recordApi.importCsv(objectNamePlural, file);
    invalidateRecords();
    return summary;
  }

  function toggleFieldVisibility(fieldMetadataId: string, isVisible: boolean): void {
    if (!viewDetail) return;
    setFieldsMutation.mutate(
      viewDetail.fields.map((f) => ({
        fieldMetadataId: f.fieldMetadataId,
        isVisible: f.fieldMetadataId === fieldMetadataId ? isVisible : f.isVisible,
        size: f.size,
      })),
    );
  }

  function toggleSort(field: DataModelField): void {
    const key = friendlyFieldKey(field);
    if (sortField !== key) {
      setSortField(key);
      setSortDirection('ASC');
    } else {
      setSortDirection((d) => (d === 'ASC' ? 'DESC' : 'ASC'));
    }
  }

  function toggleSelectAll(checked: boolean): void {
    setSelected(checked ? new Set(listResult?.records.map((r) => r.id as string) ?? []) : new Set());
  }

  function toggleSelectRow(id: string, checked: boolean): void {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function bulkDelete(): Promise<void> {
    await Promise.all([...selected].map((id) => recordApi.remove(objectNamePlural, id)));
    setSelected(new Set());
    invalidateRecords();
  }

  if (!object || !detail) {
    return <p className="p-4 text-sm text-muted-foreground">Loading…</p>;
  }

  const ObjectIcon = getIcon(object.icon);
  const total = listResult?.total ?? 0;
  const records = listResult?.records ?? [];
  const hasMore = records.length < total;
  const allSelected = records.length > 0 && selected.size === records.length;
  const labelIdentifierField = detail.fields.find((f) => f.id === detail.object.labelIdentifierFieldMetadataId);
  const isKanban = activeView?.type === 'KANBAN';
  const groupByField = activeView?.kanbanFieldMetadataId ? fieldsById.get(activeView.kanbanFieldMetadataId) : undefined;

  return (
    <div className="-m-6 flex h-[calc(100vh-3rem)] flex-col">
      <div className="flex h-10 shrink-0 items-center justify-between border-b bg-muted/20 px-3">
        <div className="flex items-center gap-2">
          <ObjectIcon className="size-4 text-muted-foreground" />
          <span className="text-sm font-semibold">
            {object.labelPlural}
            {selected.size > 0 && <span className="ml-1 font-normal text-muted-foreground">→ {selected.size} selected</span>}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {selected.size > 0 && (
            <Button variant="destructive" size="sm" onClick={() => void bulkDelete()}>
              Delete {selected.size}
            </Button>
          )}
          <Button size="sm" onClick={() => openCreate()}>
            <Plus className="size-4" /> New
          </Button>
        </div>
      </div>

      {views && (
        <RecordTableToolbar
          views={views}
          activeViewId={currentViewId}
          onSelectView={setActiveViewId}
          fields={detail.fields}
          viewFields={viewDetail?.fields ?? []}
          onToggleFieldVisibility={toggleFieldVisibility}
          onCreateView={(input) => createViewMutation.mutate(input)}
          onExport={() => void handleExport()}
          onImport={handleImport}
          search={search}
          onSearchChange={setSearch}
          filters={filters}
          onFiltersChange={setFilters}
          sortField={sortField}
          sortDirection={sortDirection}
          onSortChange={(field, direction) => {
            setSortField(field);
            setSortDirection(direction);
          }}
          isViewDirty={isViewDirty}
          onUpdateView={() => saveViewMutation.mutate()}
          onSaveAsNewView={(name) => saveAsNewViewMutation.mutate(name)}
          onRenameView={(name) => renameViewMutation.mutate(name)}
          onDuplicateView={() => duplicateViewMutation.mutate()}
          onDeleteView={() => deleteViewMutation.mutate()}
          canDeleteView={(views?.length ?? 0) > 1}
        />
      )}

      {isKanban ? (
        <div className="min-h-0 flex-1">
          {groupByField ? (
            <KanbanBoard
              objectNamePlural={objectNamePlural}
              labelIdentifierField={labelIdentifierField}
              groupByField={groupByField}
              search={search}
              filters={filters}
              onOpenRecord={setEditRecord}
              onCreateInColumn={(columnValue) =>
                openCreate(columnValue !== null ? { [friendlyFieldKey(groupByField)]: columnValue } : undefined)
              }
            />
          ) : (
            <p className="p-4 text-sm text-muted-foreground">
              This view has no group-by field set yet — edit the view to pick one.
            </p>
          )}
        </div>
      ) : (
      <div className="min-h-0 flex-1 overflow-auto">
        <Table className="w-fit min-w-full border-separate border-spacing-0">
          <TableHeader>
            <TableRow className="[&_th]:h-8 [&_th]:border-b [&_th]:border-r [&_th]:bg-background [&_th]:py-0">
              <TableHead className="sticky left-0 z-10 w-8 bg-background">
                <Checkbox checked={allSelected} onCheckedChange={(c) => toggleSelectAll(c === true)} />
              </TableHead>
              {columns.map((field) => {
                const Icon = getIcon(FIELD_TYPE_ICON[field.type] ?? 'Circle');
                return (
                  <TableHead
                    key={field.id}
                    className="cursor-pointer select-none whitespace-nowrap px-2 font-medium"
                    style={{ width: viewDetail?.fields.find((f) => f.fieldMetadataId === field.id)?.size ?? 150 }}
                    onClick={() => toggleSort(field)}
                  >
                    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Icon className="size-3.5" />
                      {field.label}
                      {sortField === friendlyFieldKey(field) && (sortDirection === 'ASC' ? ' ▲' : ' ▼')}
                    </span>
                  </TableHead>
                );
              })}
              <TableHead
                className="w-8 cursor-pointer text-center hover:bg-muted/50"
                title="Manage fields in Data Model settings"
              >
                <Link to={`/settings/objects/${object.id}`} className="flex items-center justify-center">
                  <Plus className="size-3.5 text-muted-foreground" />
                </Link>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="[&_td]:h-8 [&_td]:border-b [&_td]:border-r [&_td]:px-2 [&_td]:py-0 [&_tr:hover]:bg-muted/30">
            {isLoading && (
              <TableRow>
                <TableCell colSpan={columns.length + 2} className="text-sm text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            )}
            {!isLoading && total === 0 && (
              <TableRow>
                <TableCell colSpan={columns.length + 2} className="text-sm text-muted-foreground">
                  No {object.labelPlural.toLowerCase()} yet.
                </TableCell>
              </TableRow>
            )}
            {records.map((record) => {
              const id = record.id as string;
              return (
                <TableRow
                  key={id}
                  style={{ height: TABLE_ROW_HEIGHT }}
                  className="cursor-pointer"
                  onClick={() => setEditRecord(record)}
                >
                  <TableCell className="sticky left-0 z-10 bg-background" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selected.has(id)}
                      onCheckedChange={(c) => toggleSelectRow(id, c === true)}
                    />
                  </TableCell>
                  {columns.map((field) => (
                    <TableCell key={field.id} className="max-w-64 overflow-hidden">
                      <RecordTableCellDisplay
                        field={field}
                        record={record}
                        isLabelIdentifier={detail.object.labelIdentifierFieldMetadataId === field.id}
                      />
                    </TableCell>
                  ))}
                  <TableCell />
                </TableRow>
              );
            })}
            <TableRow className="cursor-pointer text-muted-foreground hover:bg-muted/30" onClick={() => openCreate()}>
              <TableCell colSpan={columns.length + 2}>
                <span className="inline-flex items-center gap-1.5 text-xs">
                  <Plus className="size-3.5" /> Add New
                </span>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
      )}

      {!isKanban && (
        <div className="flex h-9 shrink-0 items-center justify-between border-t px-3 text-xs text-muted-foreground">
          <span>{total} total</span>
          {hasMore && (
            <Button variant="ghost" size="sm" onClick={() => setLoadedPages((p) => p + 1)}>
              Load more
            </Button>
          )}
        </div>
      )}

      <RecordSheet
        key={`create-${createOpen}`}
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) setCreateInitialValues(undefined);
        }}
        mode="create"
        objectLabel={object.labelSingular}
        objectNameSingular={object.nameSingular}
        objectMetadataId={object.id}
        fields={detail.fields}
        initialValues={createInitialValues}
        onSubmit={(body) => createMutation.mutateAsync(body)}
      />

      {editRecord && (
        <RecordSheet
          key={editRecord.id as string}
          open={!!editRecord}
          onOpenChange={(open) => !open && setEditRecord(null)}
          mode="edit"
          objectLabel={object.labelSingular}
          objectNameSingular={object.nameSingular}
          objectMetadataId={object.id}
          fields={detail.fields}
          labelIdentifierField={labelIdentifierField}
          initialValues={editRecord}
          onSubmit={(body) => updateMutation.mutateAsync({ id: editRecord.id as string, body })}
        />
      )}
    </div>
  );
}
