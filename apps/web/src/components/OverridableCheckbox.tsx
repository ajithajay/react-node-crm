import { RotateCcw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';

export type OverridableCheckboxVisual = 'default' | 'override' | 'no_cta';

/**
 * Resolves the tri-state (blanket flag + nullable per-item override) into what the checkbox
 * should show:
 * - blanket=true, override !== false -> force-checked, disabled, offer an "X" to revoke it here
 * - blanket=true, override === false -> force-unchecked, disabled, offer a reload to un-revoke
 * - blanket=false -> a plain, freely-toggleable checkbox (override true/false directly)
 */
export function deriveOverridableCheckbox(
  blanket: boolean,
  override: boolean | null,
): { checked: boolean; disabled: boolean; visual: OverridableCheckboxVisual } {
  if (blanket) {
    if (override === false) return { checked: false, disabled: true, visual: 'override' };
    return { checked: true, disabled: true, visual: 'default' };
  }
  return { checked: override === true, disabled: false, visual: 'no_cta' };
}

export function OverridableCheckbox({
  blanket,
  override,
  onToggle,
  onRevoke,
  onReset,
}: {
  blanket: boolean;
  override: boolean | null;
  /** Called when blanket=false and the user directly toggles the checkbox. */
  onToggle: (checked: boolean) => void;
  /** Called when blanket=true and the user clicks the "X" to revoke this item's inherited access. */
  onRevoke: () => void;
  /** Called when the user clicks the reload icon to clear a revoke override back to inherited. */
  onReset: () => void;
}) {
  const { checked, disabled, visual } = deriveOverridableCheckbox(blanket, override);

  return (
    <div className="flex items-center gap-1">
      <Checkbox
        checked={checked}
        disabled={disabled}
        onCheckedChange={visual === 'no_cta' ? (next) => onToggle(next === true) : undefined}
      />
      {visual === 'default' && (
        <Button type="button" variant="ghost" size="icon-sm" onClick={onRevoke} title="Revoke for this item">
          <X className="size-3.5" />
        </Button>
      )}
      {visual === 'override' && (
        <Button type="button" variant="ghost" size="icon-sm" onClick={onReset} title="Reset to inherited">
          <RotateCcw className="size-3.5" />
        </Button>
      )}
    </div>
  );
}
