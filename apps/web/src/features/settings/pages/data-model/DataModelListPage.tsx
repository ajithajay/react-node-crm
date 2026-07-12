import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { z } from 'zod';
import { ChevronRight, Network, Plus, Search } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { IconPicker } from '@/components/IconPicker';
import { ApiError, type DataModelObject, dataModelApi } from '@/lib/api-client';
import { getIcon, ROLE_ICON_OPTIONS } from '@/lib/icons';

const createObjectSchema = z.object({
  label: z.string().trim().min(1).max(100),
  labelPlural: z.string().trim().min(1).max(100),
});
type CreateObjectValues = z.infer<typeof createObjectSchema>;

/** Best-effort English plural guess — the plural field stays editable if this is wrong. */
function guessPlural(label: string): string {
  if (label === '') return '';
  if (/[sxz]$|[cs]h$/i.test(label)) return `${label}es`;
  if (/[^aeiou]y$/i.test(label)) return `${label.slice(0, -1)}ies`;
  return `${label}s`;
}

function CreateObjectDialog() {
  const [open, setOpen] = useState(false);
  const [icon, setIcon] = useState('Circle');
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const form = useForm<CreateObjectValues>({
    resolver: zodResolver(createObjectSchema),
    defaultValues: { label: '', labelPlural: '' },
  });

  const create = useMutation({
    mutationFn: (values: CreateObjectValues) => dataModelApi.createObject({ ...values, icon }),
    onSuccess: (object) => {
      void queryClient.invalidateQueries({ queryKey: ['data-model-objects'] });
      setOpen(false);
      form.reset();
      setIcon('Circle');
      navigate(`/settings/objects/${object.id}`);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Something went wrong'),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          form.reset();
          setError(null);
        }
      }}
    >
      <DialogTrigger
        render={
          <Button type="button">
            <Plus className="size-4" /> New object
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New object</DialogTitle>
          <DialogDescription>Creates a table for this object right away.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            id="create-object-form"
            className="space-y-4"
            onSubmit={form.handleSubmit((values) => {
              setError(null);
              create.mutate(values);
            })}
          >
            <div className="space-y-2">
              <FormLabel>Icon</FormLabel>
              <div>
                <IconPicker value={icon} options={ROLE_ICON_OPTIONS} onChange={setIcon} />
              </div>
            </div>
            <FormField
              control={form.control}
              name="label"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Label (singular)</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Project"
                      onChange={(e) => {
                        field.onChange(e);
                        if (!form.formState.dirtyFields.labelPlural) {
                          form.setValue('labelPlural', guessPlural(e.target.value));
                        }
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="labelPlural"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Label (plural)</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Projects" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </form>
        </Form>
        <DialogFooter>
          <Button type="submit" form="create-object-form" disabled={create.isPending}>
            Create object
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ObjectRow({ object }: { object: DataModelObject }) {
  const navigate = useNavigate();
  const Icon = getIcon(object.icon);
  return (
    <button
      type="button"
      onClick={() => navigate(`/settings/objects/${object.id}`)}
      className="flex w-full items-center justify-between gap-3 rounded-lg border p-3 text-left text-sm hover:bg-muted/50"
    >
      <span className="flex items-center gap-2 font-medium">
        <Icon className="size-4 text-muted-foreground" />
        {object.labelPlural}
        {!object.isActive && <span className="text-xs font-normal text-muted-foreground">(inactive)</span>}
      </span>
      <span className="flex items-center gap-3 text-xs text-muted-foreground">
        {object.fieldCount} field{object.fieldCount === 1 ? '' : 's'}
        <ChevronRight className="size-4" />
      </span>
    </button>
  );
}

export function DataModelListPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const { data: objects } = useQuery({ queryKey: ['data-model-objects'], queryFn: dataModelApi.listObjects });

  const query = search.trim().toLowerCase();
  const filtered = (objects ?? []).filter((o) => query === '' || o.labelPlural.toLowerCase().includes(query));
  const standard = filtered.filter((o) => !o.isCustom);
  const custom = filtered.filter((o) => o.isCustom);

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-medium">Data Model</h1>
          <p className="text-sm text-muted-foreground">Objects and fields that make up your workspace.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate('/settings/objects/visualize')}>
            <Network className="size-4" /> Visualize
          </Button>
          <CreateObjectDialog />
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-8" placeholder="Search objects…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">Standard</p>
        <Card>
          <CardContent className="grid gap-2 pt-6 sm:grid-cols-2">
            {standard.map((object) => (
              <ObjectRow key={object.id} object={object} />
            ))}
            {standard.length === 0 && <p className="text-sm text-muted-foreground">No standard objects found.</p>}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">Custom</p>
        {custom.length === 0 ? (
          <p className="text-sm text-muted-foreground">No custom objects yet.</p>
        ) : (
          <Card>
            <CardContent className="grid gap-2 pt-6 sm:grid-cols-2">
              {custom.map((object) => (
                <ObjectRow key={object.id} object={object} />
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
