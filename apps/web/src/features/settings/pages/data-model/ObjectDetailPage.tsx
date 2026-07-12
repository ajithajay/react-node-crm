import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router';
import { z } from 'zod';
import { ArrowLeftRight, MoreHorizontal, Pencil, Plus, Power, Search, Trash, X } from 'lucide-react';
import { RelationOnDeleteAction, RelationType } from '@saasly/shared';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { IconPicker } from '@/components/IconPicker';
import { ApiError, type DataModelField, type DataModelObjectDetail, dataModelApi } from '@/lib/api-client';
import { getIcon, ROLE_ICON_OPTIONS } from '@/lib/icons';
import { FIELD_TYPE_ICON, FIELD_TYPE_LABEL, FieldFormDialog } from './field-config';

/** System fields that can't be deactivated (mirrors the API guard + Twenty). Still editable. */
const NON_DEACTIVATABLE_FIELD_NAMES = new Set(['created_at', 'updated_at', 'deleted_at', 'created_by']);

function relationTypeOf(field: DataModelField): RelationType | null {
  if (field.type !== 'RELATION' && field.type !== 'MORPH_RELATION') return null;
  return (field.settings as { relationType?: RelationType } | null)?.relationType ?? null;
}

function dataTypeLabel(field: DataModelField): string {
  if (field.type === 'MORPH_RELATION') return 'Morph Relation';
  if (field.type === 'RELATION') {
    return relationTypeOf(field) === RelationType.ONE_TO_MANY ? 'Relation · Has many' : 'Relation · Belongs to one';
  }
  return FIELD_TYPE_LABEL[field.type] ?? field.type;
}

// ---- Field table ----

function FieldRow({
  objectId,
  field,
  labelIdentifierId,
}: {
  objectId: string;
  field: DataModelField;
  labelIdentifierId: string | null;
}) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  // Prefer the field's own icon; fall back to the icon for its data type.
  const TypeIcon = field.icon && field.icon !== 'Circle' ? getIcon(field.icon) : (FIELD_TYPE_ICON[field.type] ?? getIcon('Circle'));
  const isRelation = field.type === 'RELATION' || field.type === 'MORPH_RELATION';
  const isLabelIdentifier = field.id === labelIdentifierId;

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ['data-model-object', objectId] });
  const setActive = useMutation({
    mutationFn: (isActive: boolean) => dataModelApi.setFieldActive(objectId, field.id, isActive),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: () => dataModelApi.deleteField(objectId, field.id),
    onSuccess: invalidate,
  });

  // Every field (standard, system, or custom) is editable — label, icon, and type settings like date
  // format. Deactivate is allowed except for the record label and the locked core system fields.
  // Delete drops the physical column, so it's custom-only.
  const canEdit = !isRelation;
  const canToggleActive = !isLabelIdentifier && !NON_DEACTIVATABLE_FIELD_NAMES.has(field.name);
  const canDelete = field.isCustom && !isLabelIdentifier;
  const hasMenu = canEdit || canToggleActive || canDelete;

  return (
    <TableRow className={field.isActive ? '' : 'opacity-60'}>
      <TableCell>
        <span className="flex items-center gap-2 font-medium">
          <TypeIcon className="size-4 text-muted-foreground" />
          {field.label}
          {isLabelIdentifier && <Badge variant="secondary">Record label</Badge>}
          {!field.isNullable && <Badge variant="outline">Required</Badge>}
          {field.isUnique && <Badge variant="outline">Unique</Badge>}
        </span>
      </TableCell>
      <TableCell>{field.isCustom ? 'Custom' : 'Standard'}</TableCell>
      <TableCell className="text-muted-foreground">{dataTypeLabel(field)}</TableCell>
      <TableCell className="w-10 text-right">
        {hasMenu && (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button type="button" variant="ghost" size="icon-sm">
                  <MoreHorizontal className="size-4" />
                </Button>
              }
            />
            <DropdownMenuContent align="end">
              {canEdit && (
                <DropdownMenuItem onClick={() => setEditing(true)}>
                  <Pencil className="size-4" /> Edit
                </DropdownMenuItem>
              )}
              {canToggleActive && (
                <DropdownMenuItem onClick={() => setActive.mutate(!field.isActive)}>
                  <Power className="size-4" /> {field.isActive ? 'Deactivate' : 'Activate'}
                </DropdownMenuItem>
              )}
              {canDelete && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onClick={() => remove.mutate()}>
                    <Trash className="size-4" /> Delete
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        {canEdit && <FieldFormDialog objectId={objectId} mode="edit" field={field} open={editing} onOpenChange={setEditing} />}
      </TableCell>
    </TableRow>
  );
}

function RelationRow({
  objectId,
  field,
  targetLabel,
}: {
  objectId: string;
  field: DataModelField;
  targetLabel: string | null;
}) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const TypeIcon = field.icon && field.icon !== 'Circle' ? getIcon(field.icon) : (FIELD_TYPE_ICON[field.type] ?? getIcon('Circle'));
  const type = relationTypeOf(field) === RelationType.ONE_TO_MANY ? 'Has many' : field.type === 'MORPH_RELATION' ? 'Belongs to one (morph)' : 'Belongs to one';

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ['data-model-object', objectId] });
  const setActive = useMutation({
    mutationFn: (isActive: boolean) => dataModelApi.setFieldActive(objectId, field.id, isActive),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: () => dataModelApi.deleteField(objectId, field.id),
    onSuccess: invalidate,
  });

  return (
    <TableRow>
      <TableCell>
        <span className="flex items-center gap-2 font-medium">
          <TypeIcon className="size-4 text-muted-foreground" />
          {targetLabel ? <span className="underline">{targetLabel}</span> : null}
          <span className="text-muted-foreground">· {field.label}</span>
        </span>
      </TableCell>
      <TableCell>{field.isCustom ? 'Custom' : 'Standard'}</TableCell>
      <TableCell className="text-muted-foreground">{type}</TableCell>
      <TableCell className="w-10 text-right">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button type="button" variant="ghost" size="icon-sm">
                <MoreHorizontal className="size-4" />
              </Button>
            }
          />
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setEditing(true)}>
              <Pencil className="size-4" /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setActive.mutate(!field.isActive)}>
              <Power className="size-4" /> {field.isActive ? 'Deactivate' : 'Activate'}
            </DropdownMenuItem>
            {field.isCustom && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={() => remove.mutate()}>
                  <Trash className="size-4" /> Delete
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
        <FieldFormDialog objectId={objectId} mode="edit" field={field} open={editing} onOpenChange={setEditing} />
      </TableCell>
    </TableRow>
  );
}

/** Utility objects whose relations Twenty hides from the Data Model Relations table unless Advanced. */
const UTILITY_OBJECT_PLURALS: ReadonlySet<string> = new Set([
  'workspace_members',
  'attachments',
  'note_targets',
  'task_targets',
  'timeline_activities',
]);

function FieldsTab({ detail }: { detail: DataModelObjectDetail }) {
  const objectId = detail.object.id;
  const [fieldSearch, setFieldSearch] = useState('');
  const [relationSearch, setRelationSearch] = useState('');
  const [advanced, setAdvanced] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const { data: objects } = useQuery({ queryKey: ['data-model-objects'], queryFn: dataModelApi.listObjects });

  const targetLabelFor = (field: DataModelField): string | null => {
    const settings = field.settings as { relationTargetObjectMetadataId?: string; morphTargetObjectMetadataIds?: string[] } | null;
    const targetId = settings?.relationTargetObjectMetadataId ?? settings?.morphTargetObjectMetadataIds?.[0];
    const target = objects?.find((o) => o.id === targetId);
    return target?.labelPlural ?? null;
  };

  // Twenty hides relations that are morph reverses or point at a system/utility object, unless
  // Advanced mode is on (gap: Data Model relations).
  const isSystemRelation = (field: DataModelField): boolean => {
    const settings = field.settings as { isMorphReverse?: boolean; relationTargetObjectMetadataId?: string; morphTargetObjectMetadataIds?: string[] } | null;
    if (settings?.isMorphReverse) return true;
    const targetId = settings?.relationTargetObjectMetadataId ?? settings?.morphTargetObjectMetadataIds?.[0];
    const target = objects?.find((o) => o.id === targetId);
    return target ? UTILITY_OBJECT_PLURALS.has(target.namePlural) : false;
  };

  const isRelation = (f: DataModelField) => f.type === 'RELATION' || f.type === 'MORPH_RELATION';
  const relQuery = relationSearch.trim().toLowerCase();
  const fieldQuery = fieldSearch.trim().toLowerCase();

  const relations = detail.fields
    .filter((f) => f.isActive && isRelation(f))
    .filter((f) => advanced || !isSystemRelation(f))
    .filter((f) => relQuery === '' || f.label.toLowerCase().includes(relQuery) || (targetLabelFor(f) ?? '').toLowerCase().includes(relQuery));
  const plainFields = detail.fields
    .filter((f) => f.isActive && !isRelation(f))
    .filter((f) => fieldQuery === '' || f.label.toLowerCase().includes(fieldQuery));
  const inactive = detail.fields.filter((f) => !f.isActive);

  return (
    <div className="space-y-10">
      {/* Relations section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Relations</h2>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <Switch checked={advanced} onCheckedChange={setAdvanced} />
            Advanced
          </label>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-8" placeholder="Search a relation…" value={relationSearch} onChange={(e) => setRelationSearch(e.target.value)} />
        </div>
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>App</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {relations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-muted-foreground">No relations yet.</TableCell>
                  </TableRow>
                ) : (
                  relations.map((field) => (
                    <RelationRow key={field.id} objectId={objectId} field={field} targetLabel={targetLabelFor(field)} />
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <div className="flex justify-end">
          <AddRelationDialog objectId={objectId} />
        </div>
      </div>

      {/* Fields section */}
      <div className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold">Fields</h2>
          <p className="text-sm text-muted-foreground">
            Customise the fields available in the {detail.object.labelSingular} views and their display order.
          </p>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-8" placeholder="Search a field…" value={fieldSearch} onChange={(e) => setFieldSearch(e.target.value)} />
        </div>
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>App</TableHead>
                  <TableHead>Data type</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {plainFields.map((field) => (
                  <FieldRow key={field.id} objectId={objectId} field={field} labelIdentifierId={detail.object.labelIdentifierFieldMetadataId} />
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <div className="flex justify-end">
          <Button type="button" variant="outline" size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="size-4" /> Add Field
          </Button>
          <FieldFormDialog objectId={objectId} mode="create" open={addOpen} onOpenChange={setAddOpen} />
        </div>
      </div>

      {inactive.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold">Inactive</h2>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>App</TableHead>
                    <TableHead>Data type</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inactive.map((field) => (
                    <FieldRow key={field.id} objectId={objectId} field={field} labelIdentifierId={detail.object.labelIdentifierFieldMetadataId} />
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

// ---- Relation dialog (single + morph) ----

function AddRelationDialog({ objectId }: { objectId: string }) {
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [relationType, setRelationType] = useState<RelationType>(RelationType.MANY_TO_ONE);
  const [targetIds, setTargetIds] = useState<string[]>([]);
  const [forwardLabel, setForwardLabel] = useState('');
  const [reverseLabel, setReverseLabel] = useState('');
  const [onDelete, setOnDelete] = useState<RelationOnDeleteAction>(RelationOnDeleteAction.SET_NULL);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { data: objects } = useQuery({ queryKey: ['data-model-objects'], queryFn: dataModelApi.listObjects, enabled: open });

  const selectedTargets = (objects ?? []).filter((o) => targetIds.includes(o.id));
  // Twenty's model: the *number of destinations* decides the type — one target = a plain relation,
  // more than one = a polymorphic (morph) relation. No separate "polymorphic" checkbox (gap C4).
  const isMorph = targetIds.length > 1;

  function reset(): void {
    setRelationType(RelationType.MANY_TO_ONE);
    setTargetIds([]);
    setForwardLabel('');
    setReverseLabel('');
    setOnDelete(RelationOnDeleteAction.SET_NULL);
    setError(null);
  }

  function toggleTarget(target: { id: string; labelSingular: string; labelPlural: string }): void {
    setTargetIds((prev) => {
      if (prev.includes(target.id)) return prev.filter((id) => id !== target.id);
      return [...prev, target.id];
    });
    // Seed labels from the first pick (kept editable).
    setForwardLabel((prev) => prev || target.labelSingular);
    setReverseLabel((prev) => prev || target.labelPlural);
  }

  const create = useMutation({
    mutationFn: async (): Promise<void> => {
      if (isMorph) {
        // A morph relation is always "belongs to one of" the selected objects in our engine.
        await dataModelApi.createMorphRelation(objectId, {
          targetObjectMetadataIds: targetIds,
          forwardLabel,
          reverseLabel,
          onDelete,
          isNullable: true,
        });
        return;
      }
      await dataModelApi.createRelation(objectId, {
        targetObjectMetadataId: targetIds[0]!,
        relationType,
        forwardLabel,
        reverseLabel,
        onDelete,
        isNullable: true,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['data-model-object', objectId] });
      setOpen(false);
      reset();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Something went wrong'),
  });

  const canSubmit = targetIds.length > 0 && forwardLabel.trim() !== '' && reverseLabel.trim() !== '' && !create.isPending;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger
        render={
          <Button type="button" variant="outline" size="sm">
            <ArrowLeftRight className="size-4" /> Add relation
          </Button>
        }
      />
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add relation</DialogTitle>
          <DialogDescription>Links this object to another one.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Relation type</Label>
            <Select
              value={isMorph ? RelationType.MANY_TO_ONE : relationType}
              onValueChange={(v) => v && setRelationType(v as RelationType)}
              disabled={isMorph}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={RelationType.MANY_TO_ONE}>Belongs to one</SelectItem>
                <SelectItem value={RelationType.ONE_TO_MANY}>Has many</SelectItem>
              </SelectContent>
            </Select>
            {isMorph && (
              <p className="text-xs text-muted-foreground">
                Polymorphic: this object belongs to one of the selected objects.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Related objects</Label>
            {selectedTargets.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {selectedTargets.map((t) => (
                  <Badge key={t.id} variant="secondary" className="gap-1">
                    {t.labelPlural}
                    <button type="button" onClick={() => setTargetIds((prev) => prev.filter((id) => id !== t.id))}>
                      <X className="size-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
            <Popover open={searchOpen} onOpenChange={setSearchOpen}>
              <PopoverTrigger
                render={
                  <Button type="button" variant="outline" className="w-full justify-start">
                    <Search className="size-4" /> Add an object…
                  </Button>
                }
              />
              <PopoverContent className="w-72 p-0">
                <Command>
                  <CommandInput placeholder="Search an object…" />
                  <CommandList>
                    <CommandEmpty>No objects found.</CommandEmpty>
                    <CommandGroup>
                      {objects?.map((object) => (
                        <CommandItem
                          key={object.id}
                          value={object.labelPlural}
                          onSelect={() => toggleTarget(object)}
                        >
                          <Checkbox checked={targetIds.includes(object.id)} className="mr-2" />
                          {object.labelPlural}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            <p className="text-xs text-muted-foreground">
              Pick one object for a simple relation, or multiple to make it polymorphic.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Field label on this object</Label>
            <Input value={forwardLabel} onChange={(e) => setForwardLabel(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Field label on the related object{isMorph ? 's' : ''}</Label>
            <Input value={reverseLabel} onChange={(e) => setReverseLabel(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>When the related record is deleted</Label>
            <Select value={onDelete} onValueChange={(v) => v && setOnDelete(v as RelationOnDeleteAction)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={RelationOnDeleteAction.SET_NULL}>Clear this field</SelectItem>
                <SelectItem value={RelationOnDeleteAction.CASCADE}>Delete this record too</SelectItem>
                <SelectItem value={RelationOnDeleteAction.RESTRICT}>Block the deletion</SelectItem>
                <SelectItem value={RelationOnDeleteAction.NO_ACTION}>Do nothing</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>
        <DialogFooter>
          <Button type="button" disabled={!canSubmit} onClick={() => { setError(null); create.mutate(); }}>
            Create relation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---- Settings tab (details + options + indexes + danger zone) ----

const updateObjectSchema = z.object({
  label: z.string().trim().min(1).max(100),
  labelPlural: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500).optional(),
});
type UpdateObjectValues = z.infer<typeof updateObjectSchema>;

function ObjectDetailsCard({ detail }: { detail: DataModelObjectDetail }) {
  const objectId = detail.object.id;
  const queryClient = useQueryClient();
  const [icon, setIcon] = useState(detail.object.icon);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<UpdateObjectValues>({
    resolver: zodResolver(updateObjectSchema),
    values: { label: detail.object.labelSingular, labelPlural: detail.object.labelPlural, description: detail.object.description ?? '' },
  });

  const save = useMutation({
    mutationFn: (values: UpdateObjectValues) =>
      dataModelApi.updateObject(objectId, {
        label: values.label,
        labelPlural: values.labelPlural,
        icon,
        description: values.description || undefined,
      }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['data-model-object', objectId] }),
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Something went wrong'),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          About
          {!detail.object.isCustom && <Badge variant="secondary">Standard</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((values) => { setError(null); save.mutate(values); })} className="max-w-sm space-y-4">
            <div className="space-y-2">
              <FormLabel>Icon</FormLabel>
              <div>
                <IconPicker value={icon} options={ROLE_ICON_OPTIONS} onChange={setIcon} />
              </div>
            </div>
            <FormField control={form.control} name="label" render={({ field }) => (
              <FormItem>
                <FormLabel>Label (singular)</FormLabel>
                <FormControl><Input {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="labelPlural" render={({ field }) => (
              <FormItem>
                <FormLabel>Label (plural)</FormLabel>
                <FormControl><Input {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl><Textarea {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
            <Button type="submit" disabled={save.isPending || (!form.formState.isDirty && icon === detail.object.icon)}>Save</Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

const NONE = '__none';

function ObjectOptionsCard({ detail }: { detail: DataModelObjectDetail }) {
  const objectId = detail.object.id;
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const labelOptions = detail.fields.filter((f) => f.isActive && (f.type === 'TEXT' || f.type === 'FULL_NAME'));
  const imageOptions = detail.fields.filter((f) => f.isActive && (f.type === 'FILES' || f.type === 'TEXT'));

  const save = useMutation({
    mutationFn: (input: { labelId: string | null; imageId: string | null }) =>
      dataModelApi.setObjectIdentifiers(objectId, {
        labelIdentifierFieldMetadataId: input.labelId,
        imageIdentifierFieldMetadataId: input.imageId,
      }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['data-model-object', objectId] }),
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Something went wrong'),
  });

  const labelId = detail.object.labelIdentifierFieldMetadataId;
  const imageId = detail.object.imageIdentifierFieldMetadataId;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Options</CardTitle>
      </CardHeader>
      <CardContent className="grid max-w-xl gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Record label</Label>
          <Select
            value={labelId ?? NONE}
            onValueChange={(v) => save.mutate({ labelId: v && v !== NONE ? v : null, imageId })}
          >
            <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>None</SelectItem>
              {labelOptions.map((f) => (
                <SelectItem key={f.id} value={f.id}>{f.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">The field shown as each record's title.</p>
        </div>
        <div className="space-y-2">
          <Label>Record image</Label>
          <Select
            value={imageId ?? NONE}
            onValueChange={(v) => save.mutate({ labelId, imageId: v && v !== NONE ? v : null })}
          >
            <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>None</SelectItem>
              {imageOptions.map((f) => (
                <SelectItem key={f.id} value={f.id}>{f.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">The field used as each record's avatar.</p>
        </div>
        {error && <Alert variant="destructive" className="sm:col-span-2"><AlertDescription>{error}</AlertDescription></Alert>}
      </CardContent>
    </Card>
  );
}

function AddIndexDialog({ detail }: { detail: DataModelObjectDetail }) {
  const objectId = detail.object.id;
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [fieldIds, setFieldIds] = useState<string[]>([]);
  const [isUnique, setIsUnique] = useState(false);
  const [indexType, setIndexType] = useState<'BTREE' | 'GIN'>('BTREE');
  const [error, setError] = useState<string | null>(null);

  // Indexable = active, non-relation fields (relations/composite still index on their primary column).
  const indexable = detail.fields.filter((f) => f.isActive && f.type !== 'RELATION' && f.type !== 'MORPH_RELATION' && f.type !== 'ACTOR');

  const reset = () => { setFieldIds([]); setIsUnique(false); setIndexType('BTREE'); setError(null); };

  const create = useMutation({
    mutationFn: () => dataModelApi.createIndex(objectId, { fieldMetadataIds: fieldIds, indexType, isUnique }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['data-model-object', objectId] });
      setOpen(false);
      reset();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Something went wrong'),
  });

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) reset(); }}>
      <DialogTrigger render={<Button type="button" variant="outline" size="sm"><Plus className="size-4" /> Add index</Button>} />
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add index</DialogTitle>
          <DialogDescription>Speeds up filtering/sorting on the selected fields.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Fields (selection order = column order)</Label>
            <div className="max-h-52 space-y-1 overflow-y-auto rounded-md border p-2">
              {indexable.map((f) => {
                const idx = fieldIds.indexOf(f.id);
                const Icon = FIELD_TYPE_ICON[f.type] ?? getIcon(f.icon);
                return (
                  <label key={f.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={idx >= 0}
                      onCheckedChange={(c) =>
                        setFieldIds((prev) => (c === true ? [...prev, f.id] : prev.filter((id) => id !== f.id)))
                      }
                    />
                    <Icon className="size-4 text-muted-foreground" />
                    {f.label}
                    {idx >= 0 && <span className="ml-auto text-xs text-muted-foreground">#{idx + 1}</span>}
                  </label>
                );
              })}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Index type</Label>
            <Select value={indexType} onValueChange={(v) => v && setIndexType(v as 'BTREE' | 'GIN')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="BTREE">B-tree (sorting & equality)</SelectItem>
                <SelectItem value="GIN">GIN (full-text / arrays / JSON)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={isUnique} onCheckedChange={(c) => setIsUnique(c === true)} />
            Unique
          </label>
          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
        </div>
        <DialogFooter>
          <Button type="button" disabled={fieldIds.length === 0 || create.isPending} onClick={() => { setError(null); create.mutate(); }}>
            Create index
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ObjectIndexesCard({ detail }: { detail: DataModelObjectDetail }) {
  const objectId = detail.object.id;
  const queryClient = useQueryClient();
  const remove = useMutation({
    mutationFn: (indexId: string) => dataModelApi.deleteIndex(objectId, indexId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['data-model-object', objectId] }),
  });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm">Indexes</CardTitle>
        <AddIndexDialog detail={detail} />
      </CardHeader>
      <CardContent className="p-0">
        {detail.indexes.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No custom indexes yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Fields</TableHead>
                <TableHead>Unique</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {detail.indexes.map((index) => (
                <TableRow key={index.id}>
                  <TableCell className="font-medium">{index.name}</TableCell>
                  <TableCell className="text-muted-foreground">{index.columnNames.join(', ')}</TableCell>
                  <TableCell>{index.isUnique ? 'Yes' : 'No'}</TableCell>
                  <TableCell className="text-right">
                    <Button type="button" variant="ghost" size="icon-sm" onClick={() => remove.mutate(index.id)} title="Delete index">
                      <Trash className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function DangerZoneCard({ detail }: { detail: DataModelObjectDetail }) {
  const objectId = detail.object.id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const setActive = useMutation({
    mutationFn: (isActive: boolean) => dataModelApi.setObjectActive(objectId, isActive),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['data-model-object', objectId] }),
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Something went wrong'),
  });
  const remove = useMutation({
    mutationFn: () => dataModelApi.deleteObject(objectId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['data-model-objects'] });
      navigate('/settings/objects', { replace: true });
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Something went wrong'),
  });

  if (!detail.object.isCustom) return null;

  return (
    <Card>
      <CardHeader><CardTitle>Danger zone</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
        <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
          <div>
            <p className="text-sm font-medium">{detail.object.isActive ? 'Deactivate object' : 'Reactivate object'}</p>
            <p className="text-xs text-muted-foreground">
              {detail.object.isActive ? 'Hides this object without deleting data. Required before deleting it.' : 'Makes this object visible and usable again.'}
            </p>
          </div>
          <Button variant="outline" onClick={() => setActive.mutate(!detail.object.isActive)} disabled={setActive.isPending}>
            {detail.object.isActive ? 'Deactivate' : 'Reactivate'}
          </Button>
        </div>
        <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
          <div>
            <p className="text-sm font-medium">Delete object</p>
            <p className="text-xs text-muted-foreground">
              {detail.object.isActive ? 'Deactivate this object first.' : 'Permanently deletes this object and all its records.'}
            </p>
          </div>
          <Dialog>
            <DialogTrigger render={<Button variant="destructive" disabled={detail.object.isActive}>Delete</Button>} />
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete {detail.object.labelPlural}?</DialogTitle>
                <DialogDescription>This permanently deletes the object, its fields, and all its records.</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="destructive" onClick={() => remove.mutate()} disabled={remove.isPending}>Delete object</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardContent>
    </Card>
  );
}

function SettingsTab({ detail }: { detail: DataModelObjectDetail }) {
  return (
    <div className="space-y-6">
      <ObjectDetailsCard detail={detail} />
      <ObjectOptionsCard detail={detail} />
      <ObjectIndexesCard detail={detail} />
      <DangerZoneCard detail={detail} />
    </div>
  );
}

/** Record-page section editor (Twenty parity): create named sections and assign fields to them (gap F2). */
function LayoutTab({ detail }: { detail: DataModelObjectDetail }) {
  const queryClient = useQueryClient();
  const objectId = detail.object.id;
  const { data: serverSections } = useQuery({
    queryKey: ['object-sections', objectId],
    queryFn: () => dataModelApi.getSections(objectId),
  });

  const [sections, setSections] = useState<{ label: string; fieldMetadataIds: string[] }[] | null>(null);
  const current = sections ?? (serverSections ?? []).map((s) => ({ label: s.label, fieldMetadataIds: s.fieldMetadataIds }));

  // Fields eligible to place on the record page: active scalar fields (exclude relations + system audit).
  const eligibleFields = detail.fields.filter(
    (f) => f.isActive && f.type !== 'RELATION' && f.type !== 'MORPH_RELATION' && f.isRestrictable,
  );
  const fieldById = new Map(eligibleFields.map((f) => [f.id, f]));
  const assigned = new Set(current.flatMap((s) => s.fieldMetadataIds));
  const unassigned = eligibleFields.filter((f) => !assigned.has(f.id));

  const save = useMutation({
    mutationFn: () => dataModelApi.setSections(objectId, current.filter((s) => s.label.trim())),
    onSuccess: () => {
      setSections(null);
      void queryClient.invalidateQueries({ queryKey: ['object-sections', objectId] });
    },
  });

  function update(next: { label: string; fieldMetadataIds: string[] }[]): void {
    setSections(next);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Record page sections</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Group fields into named sections (e.g. General / Business / Contact) shown on the record page. Unassigned
          fields appear in a trailing “Other” section.
        </p>

        {current.map((section, index) => (
          <div key={index} className="space-y-2 rounded-lg border p-3">
            <div className="flex items-center gap-2">
              <Input
                value={section.label}
                onChange={(e) => update(current.map((s, i) => (i === index ? { ...s, label: e.target.value } : s)))}
                className="max-w-xs"
              />
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto text-muted-foreground hover:text-destructive"
                onClick={() => update(current.filter((_, i) => i !== index))}
              >
                <X className="size-4" /> Remove
              </Button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {section.fieldMetadataIds.map((fid) => (
                <Badge key={fid} variant="secondary" className="gap-1">
                  {fieldById.get(fid)?.label ?? fid}
                  <button
                    type="button"
                    onClick={() =>
                      update(
                        current.map((s, i) =>
                          i === index ? { ...s, fieldMetadataIds: s.fieldMetadataIds.filter((x) => x !== fid) } : s,
                        ),
                      )
                    }
                  >
                    <X className="size-3" />
                  </button>
                </Badge>
              ))}
              {unassigned.length > 0 && (
                <Select
                  value=""
                  onValueChange={(fid) =>
                    fid &&
                    update(current.map((s, i) => (i === index ? { ...s, fieldMetadataIds: [...s.fieldMetadataIds, fid] } : s)))
                  }
                >
                  <SelectTrigger className="h-7 w-40 text-xs">
                    <SelectValue placeholder="+ Add field" />
                  </SelectTrigger>
                  <SelectContent>
                    {unassigned.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        ))}

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => update([...current, { label: 'New section', fieldMetadataIds: [] }])}
          >
            <Plus className="size-4" /> Add section
          </Button>
          <Button size="sm" disabled={!sections || save.isPending} onClick={() => save.mutate()}>
            Save layout
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function ObjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: detail } = useQuery({ queryKey: ['data-model-object', id], queryFn: () => dataModelApi.getObject(id!), enabled: !!id });

  if (!id || !detail) return null;
  const ObjectIcon = getIcon(detail.object.icon);
  const activeCount = detail.fields.filter((f) => f.isActive).length;

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-2">
        <ObjectIcon className="size-5 text-muted-foreground" />
        <div>
          <h1 className="text-lg font-medium">{detail.object.labelPlural}</h1>
          <p className="text-sm text-muted-foreground">
            {activeCount} active field{activeCount === 1 ? '' : 's'}
          </p>
        </div>
      </div>

      <Tabs defaultValue="fields">
        <TabsList>
          <TabsTrigger value="fields">Fields</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="layout">Layout</TabsTrigger>
        </TabsList>
        <TabsContent value="fields">
          <FieldsTab detail={detail} />
        </TabsContent>
        <TabsContent value="settings">
          <SettingsTab detail={detail} />
        </TabsContent>
        <TabsContent value="layout">
          <LayoutTab detail={detail} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
