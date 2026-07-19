import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export interface ListToolbarOption {
  value: string;
  label: string;
}

interface Props {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  filterValue: string;
  onFilterChange: (value: string) => void;
  filterOptions: ListToolbarOption[];
  sortValue: string;
  onSortChange: (value: string) => void;
  sortOptions: ListToolbarOption[];
}

/** Shared search + status filter + sort row for the workflow/run/version card-grid list pages. */
export function ListToolbar({
  search,
  onSearchChange,
  searchPlaceholder = 'Search…',
  filterValue,
  onFilterChange,
  filterOptions,
  sortValue,
  onSortChange,
  sortOptions,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative w-64 max-w-full">
        <Search className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          className="pl-8"
        />
      </div>

      <Select value={filterValue} onValueChange={(v) => v && onFilterChange(v)}>
        <SelectTrigger className="w-40">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          {filterOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={sortValue} onValueChange={(v) => v && onSortChange(v)}>
        <SelectTrigger className="w-44">
          <SelectValue placeholder="Sort by" />
        </SelectTrigger>
        <SelectContent>
          {sortOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
