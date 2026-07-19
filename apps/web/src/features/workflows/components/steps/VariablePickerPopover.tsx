import { useState, type ReactElement } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { ConditionStepSource, StepSourceField } from '../../lib/step-sources';

interface Frame {
  label: string;
  fields: StepSourceField[];
  keyPrefix: string; // accumulated path so far, relative to the step (e.g. "first" or "first.record")
  stepId: string;
}

/**
 * The step→field picker: choose a step (trigger or a prior step), then drill into its known output
 * fields to any depth — a field with its own `fields` (e.g. a Search step's "First Company") pushes
 * another level, matching Twenty's nested output-schema navigation. Falls back to a free-text path
 * when a step/field has no known shape. Produces a `{{step.a.b.c}}` template.
 *
 * Shared by BOTH sides of a condition row (left = field-to-compare, right = value/variable) and by
 * every `VariableInput` in the drawer — one mechanism, not two.
 */
export function VariablePickerPopover({
  sources,
  onPick,
  trigger,
  align = 'start',
}: {
  sources: ConditionStepSource[];
  onPick: (template: string, type?: string) => void;
  trigger: ReactElement;
  align?: 'start' | 'end';
}) {
  const [open, setOpen] = useState(false);
  const [stack, setStack] = useState<Frame[]>([]);
  const [freePath, setFreePath] = useState('');

  const pick = (tpl: string, type?: string) => {
    onPick(tpl, type);
    setOpen(false);
  };

  const enterStep = (source: ConditionStepSource) => {
    if (source.fields?.length) setStack([{ label: source.label, fields: source.fields, keyPrefix: '', stepId: source.id }]);
    else pick(`{{${source.id}.}}`);
  };

  const enterField = (field: StepSourceField) => {
    const top = stack[stack.length - 1]!;
    const nextPrefix = top.keyPrefix ? `${top.keyPrefix}.${field.key}` : field.key;
    if (field.fields?.length) {
      setStack([...stack, { label: field.label, fields: field.fields, keyPrefix: nextPrefix, stepId: top.stepId }]);
    } else {
      pick(`{{${top.stepId}.${nextPrefix}}}`, field.type);
    }
  };

  const top = stack[stack.length - 1];

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setStack(
            sources.length === 1 && sources[0]!.fields?.length
              ? [{ label: sources[0]!.label, fields: sources[0]!.fields!, keyPrefix: '', stepId: sources[0]!.id }]
              : [],
          );
        } else {
          setFreePath('');
        }
      }}
    >
      <PopoverTrigger render={trigger} />
      <PopoverContent align={align} className="w-64 p-1">
        {!top ? (
          <div className="flex flex-col">
            <div className="px-2 py-1 text-xs font-medium text-muted-foreground">Select a step</div>
            {sources.length === 0 && (
              <div className="px-2 py-1.5 text-xs text-muted-foreground">No previous steps yet.</div>
            )}
            {sources.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => enterStep(s)}
                className="flex items-center justify-between rounded px-2 py-1.5 text-left text-sm hover:bg-accent"
              >
                {s.label}
                {!!s.fields?.length && <ChevronRight className="size-3.5 text-muted-foreground" />}
              </button>
            ))}
          </div>
        ) : (
          <div className="flex flex-col">
            <button
              type="button"
              onClick={() => setStack(stack.slice(0, -1))}
              className="mb-1 flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="size-3.5" /> {top.label}
            </button>
            <div className="max-h-56 overflow-y-auto">
              {top.fields.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => enterField(f)}
                  className="flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-accent"
                >
                  <span className="min-w-0">
                    <span className="block truncate">{f.label}</span>
                    {f.description && <span className="block truncate text-[11px] text-muted-foreground">{f.description}</span>}
                  </span>
                  {!!f.fields?.length && <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />}
                </button>
              ))}
              {top.fields.length === 0 && (
                <div className="px-2 py-1.5 text-xs text-muted-foreground">No known fields — type a custom path below.</div>
              )}
            </div>
            <div className="mt-1 flex items-center gap-1 border-t p-1">
              <Input
                value={freePath}
                placeholder="custom.path"
                className="h-7"
                onChange={(e) => setFreePath(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter' || !freePath) return;
                  const prefix = top.keyPrefix ? `${top.keyPrefix}.${freePath}` : freePath;
                  pick(`{{${top.stepId}.${prefix}}}`);
                }}
              />
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
