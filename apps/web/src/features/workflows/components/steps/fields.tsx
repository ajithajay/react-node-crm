import { useRef, type ReactNode } from 'react';
import { Braces, X } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { VariablePickerPopover } from './VariablePickerPopover';
import { resolveVariableLabel, type ConditionStepSource } from '../../lib/step-sources';

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

/**
 * Text input (or textarea) that accepts `{{...}}` variables via the shared step→field picker. When
 * the ENTIRE value is a single whole variable (not mixed with literal text), it renders as a friendly
 * "Step · Field" chip instead of the raw `{{stepId.path}}` text — clicking it reopens the picker to
 * change the selection, the X clears it. Mixed/literal/empty values fall back to plain text editing.
 */
export function VariableInput({
  value,
  onChange,
  placeholder,
  sources,
  multiline = false,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  sources: ConditionStepSource[];
  multiline?: boolean;
}) {
  const ref = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const chipLabel = resolveVariableLabel(sources, value);

  const insert = (template: string) => {
    const el = ref.current;
    const pos = el?.selectionStart ?? value.length;
    onChange(value.slice(0, pos) + template + value.slice(pos));
  };

  if (chipLabel !== null) {
    return (
      <div className="flex items-center gap-1">
        <VariablePickerPopover
          sources={sources}
          onPick={(tpl) => onChange(tpl)}
          trigger={
            <button
              type="button"
              className="flex flex-1 items-center gap-1.5 rounded-md border bg-primary/5 px-2.5 py-1.5 text-left text-sm hover:bg-primary/10"
            >
              <Braces className="size-3 shrink-0 text-primary" />
              <span className="truncate">{chipLabel}</span>
            </button>
          }
        />
        <Button type="button" variant="ghost" size="icon-xs" aria-label="Clear variable" onClick={() => onChange('')}>
          <X className="size-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-1">
      {multiline ? (
        <Textarea
          ref={ref as React.Ref<HTMLTextAreaElement>}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="min-h-20 flex-1 font-mono text-xs"
        />
      ) : (
        <Input
          ref={ref as React.Ref<HTMLInputElement>}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1"
        />
      )}
      <VariablePickerPopover
        sources={sources}
        onPick={insert}
        align="end"
        trigger={
          <Button type="button" variant="ghost" size="icon-xs" aria-label="Insert variable">
            <Braces className="size-3.5" />
          </Button>
        }
      />
    </div>
  );
}
