import { useState } from 'react';
import { FieldMetadataType } from '@saasly/shared';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Copy,
  Filter as FilterIcon,
  Lock,
  MoreHorizontal,
  Pencil,
  Plus,
  Save,
  Search,
  Settings2,
  Trash2,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { DataModelField, ImportSummary, View, ViewFieldConfig } from '@/lib/api-client';
import { CreateViewDialog, type CreateViewInput } from './CreateViewDialog';
import { FilterBar, type FilterCondition } from './FilterBar';
import { ImportCsvDialog } from './ImportCsvDialog';
import { FILTERABLE_TYPES, friendlyFieldKey } from '../lib/field-values';

/** Small controlled dialog collecting a single "name" (reused for rename + save-as-new-view). */
function NamePromptDialog({
  open,
  onOpenChange,
  title,
  initialValue,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  initialValue: string;
  onSubmit: (name: string) => void;
}) {
  const [name, setName] = useState(initialValue);
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (o) setName(initialValue);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="View name" />
        <DialogFooter>
          <Button
            disabled={!name.trim()}
            onClick={() => {
              onSubmit(name.trim());
              onOpenChange(false);
            }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const OPERAND_SUMMARY: Record<string, string> = {
  IS: 'is',
  IS_NOT: 'is not',
  IS_EMPTY: 'is empty',
  IS_NOT_EMPTY: 'is not empty',
  CONTAINS: 'contains',
  DOES_NOT_CONTAIN: 'does not contain',
  LESS_THAN_OR_EQUAL: '≤',
  GREATER_THAN_OR_EQUAL: '≥',
  IS_BEFORE: 'before',
  IS_AFTER: 'after',
  IS_RELATIVE: '~',
};

/** A root-page row in the view "Options" popover — label left, contextual value/chevron right. */
function OptionsRow({ label, value, onClick }: { label: string; value: string; onClick?: () => void }) {
  const content = (
    <>
      <span>{label}</span>
      <span className="inline-flex items-center gap-1 text-muted-foreground">
        {value}
        {onClick && <ChevronRight className="size-3.5" />}
      </span>
    </>
  );
  if (!onClick) {
    return <div className="flex items-center justify-between rounded px-1 py-1.5 text-sm">{content}</div>;
  }
  return (
    <button
      type="button"
      className="flex w-full items-center justify-between rounded px-1 py-1.5 text-sm hover:bg-muted"
      onClick={onClick}
    >
      {content}
    </button>
  );
}

/** Back-chevron header for an Options popover sub-page. */
function OptionsSubHeader({ label, onBack }: { label: string; onBack: () => void }) {
  return (
    <button
      type="button"
      className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
      onClick={onBack}
    >
      <ArrowLeft className="size-3.5" /> {label}
    </button>
  );
}

function Chip({ children, onRemove }: { children: React.ReactNode; onRemove: () => void }) {
  return (
    <span className="inline-flex h-7 items-center gap-1.5 rounded-md border bg-muted/40 px-2 text-xs">
      {children}
      <button type="button" onClick={onRemove} className="text-muted-foreground hover:text-foreground">
        <X className="size-3" />
      </button>
    </span>
  );
}

/**
 * View picker + filter/sort bar: a 39px row (view name + filter/sort
 * icon buttons) above a chips row summarizing active filters/sort/search — each chip removable, a "+"
 * opens the full editor in a popover rather than a per-condition inline dropdown (a reasonable
 * simplification).
 */
/** Fields eligible as table columns at all — excludes MORPH_RELATION and reverse (ONE_TO_MANY) RELATION,
 * which have no table cell (see record-field-codec.ts) and are shown as relation widgets instead. */
function isColumnField(field: DataModelField): boolean {
  if (field.type === 'MORPH_RELATION') return false;
  if (field.type === 'RELATION' && field.settings?.relationType === 'ONE_TO_MANY') return false;
  return true;
}

export function RecordTableToolbar({
  views,
  activeViewId,
  onSelectView,
  fields,
  viewFields,
  onToggleFieldVisibility,
  onCreateView,
  onExport,
  onImport,
  search,
  onSearchChange,
  filters,
  onFiltersChange,
  sortField,
  sortDirection,
  onSortChange,
  isViewDirty,
  onUpdateView,
  onSaveAsNewView,
  onRenameView,
  onDuplicateView,
  onDeleteView,
  canDeleteView,
  onSetGroupField,
}: {
  views: View[];
  activeViewId: string | undefined;
  onSelectView: (id: string) => void;
  fields: DataModelField[];
  viewFields: ViewFieldConfig[];
  onToggleFieldVisibility: (fieldMetadataId: string, isVisible: boolean) => void;
  onCreateView: (input: CreateViewInput) => void;
  onExport: () => void;
  onImport: (file: File) => Promise<ImportSummary>;
  search: string;
  onSearchChange: (value: string) => void;
  filters: FilterCondition[];
  onFiltersChange: (filters: FilterCondition[]) => void;
  sortField: string | undefined;
  sortDirection: 'ASC' | 'DESC';
  onSortChange: (field: string | undefined, direction: 'ASC' | 'DESC') => void;
  isViewDirty: boolean;
  onUpdateView: () => void;
  onSaveAsNewView: (name: string) => void;
  onRenameView: (name: string) => void;
  onDuplicateView: () => void;
  onDeleteView: () => void;
  canDeleteView: boolean;
  onSetGroupField: (fieldMetadataId: string | undefined) => void;
}) {
  const fieldByKey = new Map(fields.map((f) => [friendlyFieldKey(f), f]));
  const sortableFields = fields.filter((f) => FILTERABLE_TYPES.has(f.type));
  const activeView = views.find((v) => v.id === activeViewId);
  const columnFields = fields.filter(isColumnField);
  const visibilityByFieldId = new Map(viewFields.map((f) => [f.fieldMetadataId, f.isVisible]));
  const [renameOpen, setRenameOpen] = useState(false);
  const [saveAsOpen, setSaveAsOpen] = useState(false);
  const [optionsPage, setOptionsPage] = useState<'root' | 'fields' | 'group'>('root');
  const visibleFieldCount = viewFields.filter((f) => f.isVisible).length;
  const groupField = activeView?.kanbanFieldMetadataId ? fields.find((f) => f.id === activeView.kanbanFieldMetadataId) : undefined;
  const selectFields = fields.filter((f) => f.type === FieldMetadataType.SELECT);

  return (
    <div className="border-b">
      <div className="flex h-9.75 items-center justify-between px-1">
        <div className="flex items-center gap-1">
          <Select value={activeViewId} onValueChange={(id) => id && onSelectView(id)}>
            <SelectTrigger className="h-7 w-auto gap-1 border-0 px-1.5 text-sm font-medium shadow-none">
              <SelectValue placeholder={activeView?.name ?? 'View'}>{activeView?.name}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {views.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* View management: rename / duplicate / delete (gap B3). The default "All <Object>" view
              is locked from rename/delete (gap G2). */}
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="sm" className="size-6 p-0" />}>
              {activeView?.isDefault ? (
                <Lock className="size-3.5 text-muted-foreground" />
              ) : (
                <MoreHorizontal className="size-3.5 text-muted-foreground" />
              )}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem disabled={activeView?.isDefault} onClick={() => setRenameOpen(true)}>
                <Pencil className="size-3.5" /> Rename
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDuplicateView}>
                <Copy className="size-3.5" /> Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                disabled={!canDeleteView || activeView?.isDefault}
                onClick={onDeleteView}
              >
                <Trash2 className="size-3.5" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <CreateViewDialog fields={fields} onCreate={onCreateView} />

          {/* "Update view" appears only when local filters/sorts differ from the saved view (gap B1). */}
          {isViewDirty && (
            <div className="ml-1 flex items-center">
              <Button size="sm" className="h-7 gap-1 rounded-r-none px-2 text-xs" onClick={onUpdateView}>
                <Save className="size-3.5" /> Update view
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger render={<Button size="sm" className="h-7 rounded-l-none border-l border-primary-foreground/20 px-1" />}>
                  <ChevronDown className="size-3.5" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setSaveAsOpen(true)}>Save as new view</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}

          <NamePromptDialog
            open={renameOpen}
            onOpenChange={setRenameOpen}
            title="Rename view"
            initialValue={activeView?.name ?? ''}
            onSubmit={onRenameView}
          />
          <NamePromptDialog
            open={saveAsOpen}
            onOpenChange={setSaveAsOpen}
            title="Save as new view"
            initialValue={`${activeView?.name ?? 'View'} copy`}
            onSubmit={onSaveAsNewView}
          />
        </div>

        <div className="flex items-center gap-1">
          <Popover>
            <PopoverTrigger render={<Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs" />}>
              <FilterIcon className="size-3.5" /> Filter
            </PopoverTrigger>
            <PopoverContent align="end" className="w-auto min-w-96">
              <FilterBar fields={fields} conditions={filters} onChange={onFiltersChange} />
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger render={<Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs" />}>
              {sortDirection === 'ASC' ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" />} Sort
            </PopoverTrigger>
            <PopoverContent align="end" className="w-56 space-y-2">
              <Select
                value={sortField}
                onValueChange={(v) => onSortChange(v || undefined, sortDirection)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Sort by…" />
                </SelectTrigger>
                <SelectContent>
                  {sortableFields.map((f) => (
                    <SelectItem key={f.id} value={friendlyFieldKey(f)}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex gap-1">
                <Button
                  variant={sortDirection === 'ASC' ? 'default' : 'outline'}
                  size="sm"
                  className="flex-1"
                  onClick={() => onSortChange(sortField, 'ASC')}
                >
                  Ascending
                </Button>
                <Button
                  variant={sortDirection === 'DESC' ? 'default' : 'outline'}
                  size="sm"
                  className="flex-1"
                  onClick={() => onSortChange(sortField, 'DESC')}
                >
                  Descending
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          <Popover onOpenChange={(open) => !open && setOptionsPage('root')}>
            <PopoverTrigger render={<Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs" />}>
              <Settings2 className="size-3.5" /> Options
            </PopoverTrigger>
            <PopoverContent align="end" className="w-64">
              {optionsPage === 'root' && (
                <div className="space-y-0.5">
                  <OptionsRow label="Layout" value={activeView?.type === 'KANBAN' ? 'Kanban' : 'Table'} />
                  <OptionsRow label="Visibility" value="Workspace" />
                  <OptionsRow
                    label="Fields"
                    value={`${visibleFieldCount} shown`}
                    onClick={() => setOptionsPage('fields')}
                  />
                  {activeView?.type === 'KANBAN' && (
                    <OptionsRow
                      label="Group"
                      value={groupField?.label ?? 'Not set'}
                      onClick={() => setOptionsPage('group')}
                    />
                  )}
                  <div className="my-1 border-t" />
                  <Button variant="ghost" size="sm" className="h-7 w-full justify-start px-2 text-xs" onClick={onExport}>
                    Export CSV
                  </Button>
                  <ImportCsvDialog fields={fields} onImport={onImport} />
                  <div className="my-1 border-t" />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-full justify-start px-2 text-xs text-destructive hover:text-destructive"
                    disabled={!canDeleteView || activeView?.isDefault}
                    onClick={onDeleteView}
                  >
                    <Trash2 className="size-3.5" /> Delete view
                  </Button>
                </div>
              )}

              {optionsPage === 'fields' && (
                <div>
                  <OptionsSubHeader label="Fields" onBack={() => setOptionsPage('root')} />
                  <div className="max-h-80 space-y-1 overflow-y-auto">
                    {columnFields.map((field) => (
                      <label key={field.id} className="flex items-center gap-2 rounded px-1 py-1 text-sm hover:bg-muted">
                        <Checkbox
                          checked={visibilityByFieldId.get(field.id) ?? true}
                          onCheckedChange={(c) => onToggleFieldVisibility(field.id, c === true)}
                        />
                        {field.label}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {optionsPage === 'group' && (
                <div>
                  <OptionsSubHeader label="Group" onBack={() => setOptionsPage('root')} />
                  <div className="max-h-80 space-y-1 overflow-y-auto">
                    <button
                      type="button"
                      className="flex w-full items-center rounded px-1 py-1 text-left text-sm hover:bg-muted"
                      onClick={() => onSetGroupField(undefined)}
                    >
                      Not set
                    </button>
                    {selectFields.map((field) => (
                      <button
                        key={field.id}
                        type="button"
                        className="flex w-full items-center rounded px-1 py-1 text-left text-sm hover:bg-muted"
                        onClick={() => onSetGroupField(field.id)}
                      >
                        {field.label}
                      </button>
                    ))}
                    {selectFields.length === 0 && (
                      <p className="px-1 py-1 text-xs text-muted-foreground">
                        This object has no Select fields yet.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="flex min-h-8 flex-wrap items-center gap-1.5 border-t px-1 py-1">
        <Popover>
          <PopoverTrigger render={<button type="button" className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs text-muted-foreground hover:bg-muted" />}>
            <Search className="size-3.5" />
            {search ? null : 'Search'}
          </PopoverTrigger>
          <PopoverContent align="start" className="w-56">
            <Input autoFocus placeholder="Search…" value={search} onChange={(e) => onSearchChange(e.target.value)} />
          </PopoverContent>
        </Popover>
        {search && <Chip onRemove={() => onSearchChange('')}>&quot;{search}&quot;</Chip>}

        {filters.map((condition, index) => {
          const field = fieldByKey.get(condition.field);
          return (
            <Chip
              key={index}
              onRemove={() => onFiltersChange(filters.filter((_, i) => i !== index))}
            >
              {field?.label ?? condition.field} {OPERAND_SUMMARY[condition.operand] ?? condition.operand}
              {condition.value !== undefined && condition.value !== null ? ` ${String(condition.value)}` : ''}
            </Chip>
          );
        })}

        {sortField && (
          <Chip onRemove={() => onSortChange(undefined, 'ASC')}>
            <button
              type="button"
              className="inline-flex items-center gap-1"
              onClick={() => onSortChange(sortField, sortDirection === 'ASC' ? 'DESC' : 'ASC')}
            >
              {fieldByKey.get(sortField)?.label ?? sortField}
              {sortDirection === 'ASC' ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
            </button>
          </Chip>
        )}

        <Popover>
          <PopoverTrigger render={<Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs" />}>
            <Plus className="size-3.5" /> Add filter
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto min-w-96">
            <FilterBar fields={fields} conditions={filters} onChange={onFiltersChange} />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
