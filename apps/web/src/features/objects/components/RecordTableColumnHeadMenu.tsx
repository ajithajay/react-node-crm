import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, EyeOff, Filter as FilterIcon } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { DataModelField } from '@/lib/api-client';
import { fieldIcon } from '../lib/field-icon';

/**
 * Column header dropdown (Twenty parity): Sort/Filter/Move left/right/Hide. The label-identifier
 * column can't be moved or hidden — guarded here the same way Twenty guards its own header menu
 * (`isLabelIdentifier` disables Move/Hide), not via any structural "pinning" in the data model.
 */
export function RecordTableColumnHeadMenu({
  field,
  isLabelIdentifier,
  isSorted,
  sortDirection,
  onSort,
  onFilter,
  canMoveLeft,
  canMoveRight,
  onMoveLeft,
  onMoveRight,
  onHide,
}: {
  field: DataModelField;
  isLabelIdentifier: boolean;
  isSorted: boolean;
  sortDirection: 'ASC' | 'DESC';
  onSort: (direction: 'ASC' | 'DESC') => void;
  onFilter: () => void;
  canMoveLeft: boolean;
  canMoveRight: boolean;
  onMoveLeft: () => void;
  onMoveRight: () => void;
  onHide: () => void;
}) {
  const Icon = fieldIcon(field);
  const canMove = !isLabelIdentifier;
  const canHide = !isLabelIdentifier;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className="inline-flex w-full items-center gap-1.5 text-xs text-muted-foreground"
          />
        }
      >
        <Icon className="size-3.5" />
        {field.label}
        {isSorted && (sortDirection === 'ASC' ? ' ▲' : ' ▼')}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem onClick={() => onSort('ASC')}>
          <ArrowUp className="size-3.5" /> Sort ascending
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onSort('DESC')}>
          <ArrowDown className="size-3.5" /> Sort descending
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onFilter}>
          <FilterIcon className="size-3.5" /> Filter by {field.label}
        </DropdownMenuItem>
        {canMove && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled={!canMoveLeft} onClick={onMoveLeft}>
              <ChevronLeft className="size-3.5" /> Move left
            </DropdownMenuItem>
            <DropdownMenuItem disabled={!canMoveRight} onClick={onMoveRight}>
              <ChevronRight className="size-3.5" /> Move right
            </DropdownMenuItem>
          </>
        )}
        {canHide && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onHide}>
              <EyeOff className="size-3.5" /> Hide field
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
