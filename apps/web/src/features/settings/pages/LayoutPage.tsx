import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FieldMetadataType } from '@saasly/shared';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { dataModelApi } from '@/lib/api-client';
import { getIcon } from '@/lib/icons';

/** Fields that never show on a record's Overview tab regardless of this toggle (see field-inputs.tsx). */
const NEVER_EDITABLE_TYPES: ReadonlySet<string> = new Set([
  FieldMetadataType.ACTOR,
  FieldMetadataType.MORPH_RELATION,
  FieldMetadataType.FILES,
]);

/**
 * Record-page layout customization (BRD §7.2) — now a real entry point, not a placeholder. Record
 * pages (the RecordSheet's Overview tab) exist since Phase 6, so the earlier "nothing to lay out
 * yet" deferral no longer holds. Scoped to what's genuinely useful without inventing a full
 * drag-and-drop section builder: per-object, toggle which fields appear on the Overview tab.
 */
export function LayoutPage() {
  const queryClient = useQueryClient();
  const [objectId, setObjectId] = useState<string | undefined>(undefined);

  const { data: objects } = useQuery({ queryKey: ['data-model-objects'], queryFn: dataModelApi.listObjects });
  const activeObjects = (objects ?? []).filter((o) => o.isActive);
  const currentObjectId = objectId ?? activeObjects[0]?.id;

  const { data: detail } = useQuery({
    queryKey: ['data-model-object', currentObjectId],
    queryFn: () => dataModelApi.getObject(currentObjectId!),
    enabled: !!currentObjectId,
  });

  const toggleMutation = useMutation({
    mutationFn: ({ fieldId, isVisible }: { fieldId: string; isVisible: boolean }) =>
      dataModelApi.setFieldRecordPageVisibility(currentObjectId!, fieldId, isVisible),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['data-model-object', currentObjectId] }),
  });

  const layoutFields = (detail?.fields ?? []).filter(
    (f) => f.isActive && !NEVER_EDITABLE_TYPES.has(f.type) && !['created_at', 'updated_at', 'deleted_at'].includes(f.name),
  );

  return (
    <div>
      <h1 className="text-lg font-medium">Layout</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Choose which fields appear on a record's Overview tab. Relation widgets (People,
        Opportunities, etc.) always show separately below the fields, and Timeline/Notes/Tasks/Files
        are managed as their own tabs, not here.
      </p>

      <div className="mt-4 max-w-xs">
        <Select value={currentObjectId} onValueChange={(id) => id && setObjectId(id)}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Choose an object…" />
          </SelectTrigger>
          <SelectContent>
            {activeObjects.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.labelPlural}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {detail && (
        <div className="mt-4 divide-y rounded-lg border">
          {layoutFields.map((field) => {
            const Icon = getIcon(field.icon);
            const isRecordLabel = field.id === detail.object.labelIdentifierFieldMetadataId;
            return (
              <label key={field.id} className="flex items-center gap-3 p-3 text-sm">
                <Checkbox
                  checked={field.isVisibleInRecordPage}
                  disabled={isRecordLabel}
                  onCheckedChange={(c) => toggleMutation.mutate({ fieldId: field.id, isVisible: c === true })}
                />
                <Icon className="size-4 text-muted-foreground" />
                <span className="flex-1">{field.label}</span>
                {isRecordLabel && <span className="text-xs text-muted-foreground">Record label — always shown</span>}
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
