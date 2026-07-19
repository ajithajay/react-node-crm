import { useState } from 'react';
import { FieldMetadataType } from '@saasly/shared';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { DataModelField } from '@/lib/api-client';

export interface CreateViewInput {
  name: string;
  type: 'TABLE' | 'KANBAN';
  groupByFieldMetadataId?: string;
}

/** Kanban view is grouped by a Select field — only SELECT fields are offered as the group-by. */
export function CreateViewDialog({
  fields,
  onCreate,
}: {
  fields: DataModelField[];
  onCreate: (input: CreateViewInput) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState<'TABLE' | 'KANBAN'>('TABLE');
  const [groupByFieldId, setGroupByFieldId] = useState<string | undefined>(undefined);

  const selectFields = fields.filter((f) => f.type === FieldMetadataType.SELECT);

  function handleCreate(): void {
    if (!name.trim()) return;
    onCreate({ name: name.trim(), type, groupByFieldMetadataId: type === 'KANBAN' ? groupByFieldId : undefined });
    setOpen(false);
    setName('');
    setType('TABLE');
    setGroupByFieldId(undefined);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="sm" className="size-6 p-0" />}>+</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New view</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="My view" />
          </div>
          <div>
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => v && setType(v as 'TABLE' | 'KANBAN')}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TABLE">Table</SelectItem>
                <SelectItem value="KANBAN">Kanban</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {type === 'KANBAN' && (
            <div>
              <Label>Group by</Label>
              <Select value={groupByFieldId} onValueChange={(v) => v && setGroupByFieldId(v)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a field…" />
                </SelectTrigger>
                <SelectContent>
                  {selectFields.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectFields.length === 0 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  This object has no Select fields yet — add one in Data Model settings first.
                </p>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button onClick={handleCreate} disabled={!name.trim() || (type === 'KANBAN' && !groupByFieldId)}>
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
