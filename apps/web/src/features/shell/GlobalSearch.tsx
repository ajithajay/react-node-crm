import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { searchApi, type SearchResult } from '@/lib/api-client';
import { getIcon } from '@/lib/icons';

/** Debounces a value by `delayMs` — no results/API calls fire until typing pauses. */
function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

/**
 * Global ⌘K / Ctrl+K quick-jump palette: cross-object full-text search (`GET /search`), grouped by
 * object type, navigating straight to the record on select. Running a GLOBAL workflow lives next to
 * this button instead (`RunWorkflowActions` in `ShellLayout`), not in this palette.
 */
export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, 200);
  const navigate = useNavigate();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent): void {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  const { data: results } = useQuery({
    queryKey: ['global-search', debouncedQuery],
    queryFn: () => searchApi.search(debouncedQuery),
    enabled: open && debouncedQuery.trim().length > 0,
  });

  function selectResult(result: SearchResult): void {
    setOpen(false);
    navigate(`/objects/${result.objectNamePlural}/${result.recordId}`);
  }

  const groups = groupByObject(results ?? []);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="h-7 gap-2 px-2 text-xs text-muted-foreground"
        onClick={() => setOpen(true)}
      >
        <Search className="size-3.5" />
        Search
        <kbd className="ml-1 rounded border bg-muted px-1 font-mono text-[10px]">⌘K</kbd>
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen} title="Search" description="Jump to a record…">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Search companies, people, deals…" value={query} onValueChange={setQuery} />
          <CommandList>
            {debouncedQuery.trim().length > 0 && <CommandEmpty>No matches found.</CommandEmpty>}
            {groups.map(([objectLabel, items]) => (
              <CommandGroup key={objectLabel} heading={objectLabel}>
                {items.map((result) => {
                  const Icon = getIcon(result.icon ?? 'Circle');
                  return (
                    <CommandItem
                      key={`${result.objectMetadataId}-${result.recordId}`}
                      value={`${result.objectMetadataId}-${result.recordId}-${result.label}`}
                      onSelect={() => selectResult(result)}
                    >
                      <Icon className="size-4 text-muted-foreground" />
                      {result.label}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}

function groupByObject(results: SearchResult[]): [string, SearchResult[]][] {
  const groups = new Map<string, SearchResult[]>();
  for (const result of results) {
    const list = groups.get(result.objectLabel) ?? [];
    list.push(result);
    groups.set(result.objectLabel, list);
  }
  return [...groups.entries()];
}
