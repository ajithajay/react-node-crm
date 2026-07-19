import { Plus, Trash2 } from 'lucide-react';
import type { StepFilter, StepFilterGroup } from '@saasly/shared';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { newId } from '../../lib/id';
import { VariableInput } from './fields';
import { VariablePickerPopover } from './VariablePickerPopover';
import { resolveVariableLabel, type ConditionStepSource } from '../../lib/step-sources';

export interface ConditionValue {
  stepFilters: StepFilter[];
  stepFilterGroups: StepFilterGroup[];
}

const OPERANDS_BY_TYPE: Record<string, { value: string; label: string; noValue?: boolean }[]> = {
  TEXT: [
    { value: 'contains', label: 'Contains' },
    { value: 'doesNotContain', label: 'Does not contain' },
    { value: 'eq', label: 'Is' },
    { value: 'ne', label: 'Is not' },
    { value: 'isEmpty', label: 'Is empty', noValue: true },
    { value: 'isNotEmpty', label: 'Is not empty', noValue: true },
  ],
  NUMBER: [
    { value: 'eq', label: 'Is' },
    { value: 'ne', label: 'Is not' },
    { value: 'gt', label: 'Greater than' },
    { value: 'gte', label: 'Greater or equal' },
    { value: 'lt', label: 'Less than' },
    { value: 'lte', label: 'Less or equal' },
    { value: 'isEmpty', label: 'Is empty', noValue: true },
    { value: 'isNotEmpty', label: 'Is not empty', noValue: true },
  ],
  BOOLEAN: [
    { value: 'isTrue', label: 'Is true', noValue: true },
    { value: 'isFalse', label: 'Is false', noValue: true },
  ],
  SELECT: [
    { value: 'eq', label: 'Is' },
    { value: 'ne', label: 'Is not' },
    { value: 'isEmpty', label: 'Is empty', noValue: true },
    { value: 'isNotEmpty', label: 'Is not empty', noValue: true },
  ],
  DATE: [
    { value: 'eq', label: 'Is' },
    { value: 'gt', label: 'Is after' },
    { value: 'lt', label: 'Is before' },
    { value: 'isEmpty', label: 'Is empty', noValue: true },
    { value: 'isNotEmpty', label: 'Is not empty', noValue: true },
  ],
};
const DEFAULT_OPERANDS = OPERANDS_BY_TYPE.TEXT!;

function operandsForType(type: string): { value: string; label: string; noValue?: boolean }[] {
  if (type === 'NUMBER' || type === 'RATING' || type === 'CURRENCY') return OPERANDS_BY_TYPE.NUMBER!;
  if (type === 'BOOLEAN') return OPERANDS_BY_TYPE.BOOLEAN!;
  if (type === 'SELECT' || type === 'MULTI_SELECT' || type === 'RELATION') return OPERANDS_BY_TYPE.SELECT!;
  if (type === 'DATE' || type === 'DATE_TIME') return OPERANDS_BY_TYPE.DATE!;
  return DEFAULT_OPERANDS;
}

const ROOT_GROUP = 'root';

/**
 * The condition builder — a flat `stepFilters` + `stepFilterGroups` model, joined by
 * ids, with one level of nesting and AND/OR per group. Both sides of a rule go through the same
 * step→field picker (`VariablePickerPopover`): `steps` sources the LEFT (field-to-compare) side,
 * `sources` the RIGHT (value/variable) side — usually the same array, except e.g. Search records
 * where the left side is restricted to the searched object's own fields.
 */
export function ConditionBuilder({
  value,
  steps,
  sources,
  onChange,
}: {
  value: ConditionValue;
  steps: ConditionStepSource[];
  sources: ConditionStepSource[];
  onChange: (value: ConditionValue) => void;
}) {
  const groups = value.stepFilterGroups ?? [];
  const filters = value.stepFilters ?? [];
  const hasRoot = groups.some((g) => g.id === ROOT_GROUP);

  const ensureRoot = (): StepFilterGroup[] =>
    hasRoot ? groups : [{ id: ROOT_GROUP, logicalOperator: 'AND' as const }, ...groups];

  const addRule = (groupId: string) => {
    onChange({
      stepFilterGroups: ensureRoot(),
      stepFilters: [...filters, { id: newId(), operand: 'eq', stepFilterGroupId: groupId }],
    });
  };
  const addGroup = () => {
    const gid = newId();
    onChange({
      stepFilterGroups: [...ensureRoot(), { id: gid, logicalOperator: 'AND', parentStepFilterGroupId: ROOT_GROUP }],
      stepFilters: [...filters, { id: newId(), operand: 'eq', stepFilterGroupId: gid }],
    });
  };
  const updateFilter = (id: string, patch: Partial<StepFilter>) =>
    onChange({ stepFilterGroups: groups, stepFilters: filters.map((f) => (f.id === id ? { ...f, ...patch } : f)) });
  const removeFilter = (id: string) =>
    onChange({ stepFilterGroups: groups, stepFilters: filters.filter((f) => f.id !== id) });
  const setGroupOperator = (groupId: string, op: 'AND' | 'OR') =>
    onChange({
      stepFilterGroups: groups.map((g) => (g.id === groupId ? { ...g, logicalOperator: op } : g)),
      stepFilters: filters,
    });

  const rootFilters = filters.filter((f) => (f.stepFilterGroupId ?? ROOT_GROUP) === ROOT_GROUP);
  const subGroups = groups.filter((g) => g.parentStepFilterGroupId === ROOT_GROUP);

  return (
    <div className="flex flex-col gap-3">
      <GroupRows
        operator={groups.find((g) => g.id === ROOT_GROUP)?.logicalOperator ?? 'AND'}
        rows={rootFilters}
        steps={steps}
        sources={sources}
        onSetOperator={(op) => setGroupOperator(ROOT_GROUP, op)}
        onUpdate={updateFilter}
        onRemove={removeFilter}
      />

      {subGroups.map((g) => (
        <div key={g.id} className="rounded-md border border-dashed p-2">
          <GroupRows
            operator={g.logicalOperator}
            rows={filters.filter((f) => f.stepFilterGroupId === g.id)}
            steps={steps}
            sources={sources}
            onSetOperator={(op) => setGroupOperator(g.id, op)}
            onUpdate={updateFilter}
            onRemove={removeFilter}
          />
          <Button variant="ghost" size="sm" className="mt-1" onClick={() => addRule(g.id)}>
            <Plus className="size-3.5" /> Add rule
          </Button>
        </div>
      ))}

      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => addRule(ROOT_GROUP)}>
          <Plus className="size-4" /> Add rule
        </Button>
        <Button variant="outline" size="sm" onClick={addGroup}>
          <Plus className="size-4" /> Add rule group
        </Button>
      </div>
    </div>
  );
}

function GroupRows({
  operator,
  rows,
  steps,
  sources,
  onSetOperator,
  onUpdate,
  onRemove,
}: {
  operator: 'AND' | 'OR';
  rows: StepFilter[];
  steps: ConditionStepSource[];
  sources: ConditionStepSource[];
  onSetOperator: (op: 'AND' | 'OR') => void;
  onUpdate: (id: string, patch: Partial<StepFilter>) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      {rows.map((row, index) => {
        const operands = operandsForType((row.type as string) ?? 'TEXT');
        const activeOperand = operands.find((o) => o.value === row.operand);
        const label = (row.leftValue ? resolveVariableLabel(steps, String(row.leftValue)) : null) ?? 'Select a field';
        return (
          <div key={row.id} className="flex flex-col gap-1.5 rounded-md border p-2">
            <div className="flex items-center gap-2">
              <span className="w-16 shrink-0 text-xs text-muted-foreground">
                {index === 0 ? (
                  'Where'
                ) : index === 1 ? (
                  <Select value={operator} onValueChange={(v) => v && onSetOperator(v as 'AND' | 'OR')}>
                    <SelectTrigger className="h-7 w-16">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AND">And</SelectItem>
                      <SelectItem value="OR">Or</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  operator === 'OR' ? 'Or' : 'And'
                )}
              </span>
              <VariablePickerPopover
                sources={steps}
                onPick={(tpl, type) =>
                  onUpdate(row.id, { leftValue: tpl, type: type ?? 'TEXT', operand: operandsForType(type ?? 'TEXT')[0]?.value ?? 'eq' })
                }
                trigger={
                  <Button type="button" variant="outline" size="sm" className="min-w-0 flex-1 justify-start font-normal">
                    <span className="truncate">{label}</span>
                  </Button>
                }
              />
              <Button variant="ghost" size="icon-xs" aria-label="Remove rule" onClick={() => onRemove(row.id)}>
                <Trash2 className="size-3.5" />
              </Button>
            </div>
            <div className="flex items-center gap-2 pl-16">
              <Select value={row.operand} onValueChange={(v) => v && onUpdate(row.id, { operand: v })}>
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {operands.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!activeOperand?.noValue && (
                <div className="min-w-0 flex-1">
                  <VariableInput
                    value={(row.rightValue as string) ?? ''}
                    onChange={(v) => onUpdate(row.id, { rightValue: v })}
                    sources={sources}
                    placeholder="Value"
                  />
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
