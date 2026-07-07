import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ALL_ICON_NAMES, getIcon } from '@/lib/icons';

const MAX_RESULTS = 90;

export function IconPicker({
  value,
  options,
  onChange,
}: {
  value: string;
  /** A curated set shown before the user searches — falls back to the full library once they type. */
  options: readonly string[];
  onChange: (icon: string) => void;
}) {
  const [search, setSearch] = useState('');
  const SelectedIcon = getIcon(value);

  const results = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (query === '') return options;
    return ALL_ICON_NAMES.filter((name) => name.toLowerCase().includes(query)).slice(0, MAX_RESULTS);
  }, [search, options]);

  return (
    <Popover onOpenChange={(open) => !open && setSearch('')}>
      <PopoverTrigger
        render={
          <Button type="button" variant="outline" size="icon">
            <SelectedIcon className="size-4" />
          </Button>
        }
      />
      <PopoverContent className="w-72 p-2">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Search icons…" value={search} onValueChange={setSearch} />
          <CommandList className="max-h-56">
            <CommandEmpty>No icons found.</CommandEmpty>
            <CommandGroup>
              <div className="grid grid-cols-7 gap-1">
                {results.map((iconName) => {
                  const Icon = getIcon(iconName);
                  return (
                    <CommandItem
                      key={iconName}
                      value={iconName}
                      onSelect={() => onChange(iconName)}
                      className="flex size-9 items-center justify-center p-0 data-[selected=true]:bg-muted"
                    >
                      <Icon className="size-4" />
                    </CommandItem>
                  );
                })}
              </div>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
