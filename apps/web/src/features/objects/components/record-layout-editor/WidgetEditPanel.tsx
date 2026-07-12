import { useState } from 'react';
import { Eye, EyeOff, GripVertical, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { FIELD_DISPLAY_MODES, type FieldDisplayMode } from '@saasly/shared';
import { type DataModelField, type PageLayout, type PageLayoutTab, type PageLayoutWidget } from '@/lib/api-client';
import { isEditableField, isFieldWidgetPickable } from '../../lib/field-inputs';
import * as draft from '../../lib/page-layout-draft';

const WIDGET_TITLES: Record<string, string> = {
  FIELDS: 'Fields',
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
  CHIP_LIST: 'Multiple options',
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{children}</h3>;
}

/** The nested "Layout" editor for a FIELDS widget: groups + fields, both drag-reorderable. */
function FieldsLayoutEditor({
  widget,
  objectFields,
  onChange,
  onBack,
}: {
  widget: PageLayoutWidget;
  objectFields: DataModelField[];
  onChange: (w: PageLayoutWidget) => void;
  onBack: () => void;
}) {
  const [draggingGroup, setDraggingGroup] = useState<string | null>(null);
  const [draggingField, setDraggingField] = useState<string | null>(null);
  const fieldById = new Map(objectFields.map((f) => [f.id, f]));
  const assignedIds = new Set(widget.groups.flatMap((g) => g.fields.map((f) => f.fieldMetadataId)));
  const unassigned = objectFields.filter((f) => isEditableField(f) && !assignedIds.has(f.id));

  return (
    <div className="space-y-3 px-4 py-4">
      <Button variant="ghost" size="sm" onClick={onBack}>
        ← Back
      </Button>
      {widget.groups.map((group) => (
        <div
          key={group.id}
          draggable
          onDragStart={() => setDraggingGroup(group.id)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => {
            if (draggingGroup && draggingGroup !== group.id) onChange(draft.reorderGroups(widget, draggingGroup, group.id));
            setDraggingGroup(null);
          }}
          className="rounded-lg border"
        >
          <div className="flex items-center gap-1.5 border-b px-2 py-1.5">
            <GripVertical className="size-3.5 shrink-0 cursor-grab text-muted-foreground" />
            <Input
              value={group.label}
              onChange={(e) => onChange(draft.updateGroup(widget, group.id, (g) => ({ ...g, label: e.target.value })))}
              className="h-7 flex-1 text-xs"
            />
            <button
              type="button"
              onClick={() => onChange(draft.updateGroup(widget, group.id, (g) => ({ ...g, isVisible: !g.isVisible })))}
              className="text-muted-foreground"
              title={group.isVisible ? 'Hide group' : 'Show group'}
            >
              {group.isVisible ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
            </button>
            <button type="button" onClick={() => onChange(draft.deleteGroup(widget, group.id))} className="text-destructive">
              <X className="size-3.5" />
            </button>
          </div>
          <div
            className="space-y-1 p-2"
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (draggingField) onChange(draft.moveField(widget, draggingField, group.id, group.fields.length));
              setDraggingField(null);
            }}
          >
            {group.fields.map((gf, idx) => {
              const field = fieldById.get(gf.fieldMetadataId);
              return (
                <div
                  key={gf.fieldMetadataId}
                  draggable
                  onDragStart={() => setDraggingField(gf.fieldMetadataId)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onDrop={(e) => {
                    e.stopPropagation();
                    if (draggingField) onChange(draft.moveField(widget, draggingField, group.id, idx));
                    setDraggingField(null);
                  }}
                  className="flex items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-muted/50"
                >
                  <GripVertical className="size-3.5 shrink-0 cursor-grab text-muted-foreground" />
                  <Checkbox
                    checked={gf.isVisible}
                    onCheckedChange={(c) =>
                      onChange(
                        draft.updateGroup(widget, group.id, (g) => ({
                          ...g,
                          fields: g.fields.map((f) => (f.fieldMetadataId === gf.fieldMetadataId ? { ...f, isVisible: c === true } : f)),
                        })),
                      )
                    }
                  />
                  <span className="flex-1 truncate">{field?.label ?? gf.label}</span>
                </div>
              );
            })}
          </div>
          {unassigned.length > 0 && (
            <div className="border-t p-2">
              <Select
                value=""
                onValueChange={(fid: string | null) => {
                  const field = fid ? fieldById.get(fid) : undefined;
                  if (!fid || !field) return;
                  onChange(
                    draft.updateGroup(widget, group.id, (g) => ({
                      ...g,
                      fields: [...g.fields, { fieldMetadataId: fid, isVisible: true, label: field.label, icon: field.icon, fieldType: field.type }],
                    })),
                  );
                }}
              >
                <SelectTrigger className="h-7 w-full text-xs">
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
            </div>
          )}
        </div>
      ))}
      <Button variant="outline" size="sm" className="w-full" onClick={() => onChange(draft.addGroup(widget))}>
        <Plus className="size-3.5" /> Add group
      </Button>
    </div>
  );
}

export function WidgetEditPanel({
  tab,
  widget,
  allTabs,
  objectFields,
  onClose,
  onUpdateLayout,
  onResetWidget,
}: {
  tab: PageLayoutTab;
  widget: PageLayoutWidget;
  allTabs: PageLayoutTab[];
  objectFields: DataModelField[];
  onClose: () => void;
  onUpdateLayout: (updater: (l: PageLayout) => PageLayout) => void;
  /** Persisted widgets reset via the server (recomputes real defaults); unsaved (temp-id) widgets
   * just reset their local draft configuration — there is nothing persisted yet to fetch. */
  onResetWidget: () => void;
}) {
  const [step, setStep] = useState<'menu' | 'layout' | 'move-tab'>('menu');

  function setWidget(next: PageLayoutWidget): void {
    onUpdateLayout((l) => draft.updateWidget(l, tab.id, widget.id, () => next));
  }

  function move(dir: -1 | 1): void {
    onUpdateLayout((l) => draft.moveWidget(l, tab.id, widget.id, dir));
  }

  function reset(): void {
    if (widget.id.startsWith('new-')) {
      setWidget({ ...widget, isVisible: true, configuration: widget.type === 'FIELDS' ? { showMoreFieldsButton: false, autoVisibleNewFields: true } : {} });
    } else {
      onResetWidget();
    }
  }

  function remove(): void {
    onUpdateLayout((l) => draft.deleteWidget(l, tab.id, widget.id));
    onClose();
  }

  const isFields = widget.type === 'FIELDS';
  const isField = widget.type === 'FIELD';

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-96">
        <SheetHeader className="border-b">
          <SheetTitle>
            {WIDGET_TITLES[widget.type] ?? widget.title}
            <span className="ml-2 text-xs font-normal text-muted-foreground">{widget.title}</span>
          </SheetTitle>
        </SheetHeader>

        {step === 'menu' && (
          <div className="space-y-6 px-4 py-4">
            {(isFields || isField) && (
              <div>
                <SectionLabel>Data and display</SectionLabel>
                <div className="space-y-1">
                  {isFields && (
                    <button
                      type="button"
                      onClick={() => setStep('layout')}
                      className="flex w-full items-center justify-between rounded px-1 py-1.5 text-sm hover:bg-muted"
                    >
                      <span>Layout</span>
                      <span className="text-xs text-muted-foreground">
                        {widget.groups.flatMap((g) => g.fields).filter((f) => f.isVisible).length} visible fields ›
                      </span>
                    </button>
                  )}
                  {isFields && (
                    <>
                      <div className="flex items-center justify-between px-1 py-1.5 text-sm">
                        <span>Display &quot;More fields&quot; button</span>
                        <Switch
                          checked={widget.configuration.showMoreFieldsButton === true}
                          onCheckedChange={(c) => setWidget({ ...widget, configuration: { ...widget.configuration, showMoreFieldsButton: c } })}
                        />
                      </div>
                      <div className="flex items-center justify-between px-1 py-1.5 text-sm">
                        <span>Set fields created in the future as &quot;visible&quot;</span>
                        <Switch
                          checked={widget.configuration.autoVisibleNewFields !== false}
                          onCheckedChange={(c) => setWidget({ ...widget, configuration: { ...widget.configuration, autoVisibleNewFields: c } })}
                        />
                      </div>
                    </>
                  )}
                  {isField && (
                    <>
                      <div className="px-1 py-1.5 text-sm">
                        <span className="mb-1 block text-muted-foreground">Field</span>
                        <Select
                          value={widget.configuration.fieldMetadataId ?? ''}
                          onValueChange={(fid: string | null) => fid && setWidget({ ...widget, configuration: { ...widget.configuration, fieldMetadataId: fid } })}
                        >
                          <SelectTrigger className="h-8 w-full">
                            <SelectValue placeholder="Pick a field…" />
                          </SelectTrigger>
                          <SelectContent>
                            {objectFields.filter(isFieldWidgetPickable).map((f) => (
                              <SelectItem key={f.id} value={f.id}>
                                {f.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="px-1 py-1.5 text-sm">
                        <span className="mb-1 block text-muted-foreground">Layout</span>
                        <Select
                          value={widget.configuration.displayMode ?? 'PLAIN'}
                          onValueChange={(m: string | null) =>
                            m && setWidget({ ...widget, configuration: { ...widget.configuration, displayMode: m as FieldDisplayMode } })
                          }
                        >
                          <SelectTrigger className="h-8 w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {FIELD_DISPLAY_MODES.map((m) => (
                              <SelectItem key={m} value={m}>
                                {DISPLAY_MODE_LABELS[m]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            <div>
              <SectionLabel>Manage</SectionLabel>
              <div className="space-y-0.5">
                <Button variant="ghost" size="sm" className="w-full justify-start" onClick={reset}>
                  Reset to default
                </Button>
                <Button variant="ghost" size="sm" className="w-full justify-start text-destructive hover:text-destructive" onClick={remove}>
                  Delete widget
                </Button>
              </div>
            </div>

            <div>
              <SectionLabel>Placement</SectionLabel>
              <div className="space-y-0.5">
                <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => move(-1)}>
                  Move up
                </Button>
                <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => move(1)}>
                  Move down
                </Button>
                {allTabs.length > 1 && (
                  <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => setStep('move-tab')}>
                    Move to another tab
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        {step === 'layout' && isFields && (
          <FieldsLayoutEditor widget={widget} objectFields={objectFields} onChange={setWidget} onBack={() => setStep('menu')} />
        )}

        {step === 'move-tab' && (
          <div className="space-y-1 px-4 py-4">
            <Button variant="ghost" size="sm" onClick={() => setStep('menu')}>
              ← Back
            </Button>
            {allTabs
              .filter((t) => t.id !== tab.id)
              .map((t) => (
                <Button
                  key={t.id}
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => {
                    onUpdateLayout((l) => draft.moveWidgetToTab(l, tab.id, widget.id, t.id));
                    onClose();
                  }}
                >
                  {t.title}
                </Button>
              ))}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
