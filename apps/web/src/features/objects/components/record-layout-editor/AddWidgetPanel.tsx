import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { type FieldDisplayMode, type PageLayoutWidgetType } from '@saasly/shared';
import type { DataModelField } from '@/lib/api-client';
import { displayModesForField, isFieldWidgetPickable } from '../../lib/field-inputs';

const WIDGET_TYPE_LABELS: Record<PageLayoutWidgetType, string> = {
  FIELDS: 'Fields group',
  FIELD: 'Field',
  TIMELINE: 'Timeline',
  NOTES: 'Notes',
  TASKS: 'Tasks',
  FILES: 'Files',
};

const DISPLAY_MODE_LABELS: Record<FieldDisplayMode, string> = {
  PLAIN: 'Field',
  CARD: 'Card',
  TABLE: 'Table',
  DOCUMENT: 'Document',
};

/** Widget-type picker used both for "Add widget above/below" and a brand-new empty tab. */
export function AddWidgetPanel({
  availableTypes,
  objectFields,
  onClose,
  onAdd,
}: {
  /** Singleton widget types (Fields/Timeline/Notes/Tasks/Files) not already present anywhere in the
   * layout. FIELD has no singleton limit — always offered. */
  availableTypes: PageLayoutWidgetType[];
  objectFields: DataModelField[];
  onClose: () => void;
  onAdd: (type: PageLayoutWidgetType, title: string, configuration: Record<string, unknown>) => void;
}) {
  const [pickingField, setPickingField] = useState(false);
  const [fieldId, setFieldId] = useState('');
  const [displayMode, setDisplayMode] = useState<FieldDisplayMode>('PLAIN');

  const eligibleFields = objectFields.filter(isFieldWidgetPickable);

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-80">
        <SheetHeader className="border-b">
          <SheetTitle>{pickingField ? 'Add field widget' : 'Add widget'}</SheetTitle>
        </SheetHeader>

        {!pickingField && (
          <div className="space-y-0.5 px-4 py-4">
            {availableTypes.map((type) => (
              <Button
                key={type}
                variant="ghost"
                size="sm"
                className="w-full justify-start"
                onClick={() => {
                  if (type === 'FIELD') {
                    setPickingField(true);
                  } else {
                    onAdd(type, WIDGET_TYPE_LABELS[type], {});
                  }
                }}
              >
                {WIDGET_TYPE_LABELS[type]}
              </Button>
            ))}
          </div>
        )}

        {pickingField &&
          (() => {
            const selectedField = eligibleFields.find((f) => f.id === fieldId);
            const modes = selectedField ? displayModesForField(selectedField) : (['PLAIN'] as FieldDisplayMode[]);
            const effectiveMode = modes.includes(displayMode) ? displayMode : modes[0]!;
            return (
              <div className="space-y-4 px-4 py-4">
                <div>
                  <span className="mb-1 block text-sm text-muted-foreground">Field</span>
                  <Select
                    value={fieldId}
                    onValueChange={(v: string | null) => {
                      if (!v) return;
                      setFieldId(v);
                      const f = eligibleFields.find((x) => x.id === v);
                      if (f) setDisplayMode(displayModesForField(f)[0]!);
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Pick a field…" />
                    </SelectTrigger>
                    <SelectContent>
                      {eligibleFields.map((f) => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {modes.length > 1 && (
                  <div>
                    <span className="mb-1 block text-sm text-muted-foreground">Layout</span>
                    <Select value={effectiveMode} onValueChange={(v: string | null) => v && setDisplayMode(v as FieldDisplayMode)}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {modes.map((m) => (
                          <SelectItem key={m} value={m}>
                            {DISPLAY_MODE_LABELS[m]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <Button
                  disabled={!fieldId}
                  onClick={() => onAdd('FIELD', selectedField?.label ?? 'Field', { fieldMetadataId: fieldId, displayMode: effectiveMode })}
                >
                  Add
                </Button>
              </div>
            );
          })()}
      </SheetContent>
    </Sheet>
  );
}
