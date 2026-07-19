import { FieldMetadataType, ViewFilterOperand, type SelectOption } from '@saasly/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { DataModelField, RowLevelPermissionCondition } from '@/lib/api-client';
import { RelationPickerInput } from '@/features/objects/components/RelationPickerInput';
import { FILTERABLE_TYPES, operandsForType } from '@/features/objects/lib/field-values';

const OPERAND_LABELS: Record<string, string> = {
  [ViewFilterOperand.IS]: 'is',
  [ViewFilterOperand.IS_NOT]: 'is not',
  [ViewFilterOperand.IS_EMPTY]: 'is empty',
  [ViewFilterOperand.IS_NOT_EMPTY]: 'is not empty',
  [ViewFilterOperand.CONTAINS]: 'contains',
  [ViewFilterOperand.DOES_NOT_CONTAIN]: 'does not contain',
  [ViewFilterOperand.LESS_THAN_OR_EQUAL]: '≤',
  [ViewFilterOperand.GREATER_THAN_OR_EQUAL]: '≥',
  [ViewFilterOperand.IS_BEFORE]: 'is before',
  [ViewFilterOperand.IS_AFTER]: 'is after',
  [ViewFilterOperand.IS_RELATIVE]: 'is relative',
};

const NO_VALUE_OPERANDS: ReadonlySet<string> = new Set([ViewFilterOperand.IS_EMPTY, ViewFilterOperand.IS_NOT_EMPTY]);
/** Only equality operators can compare against the caller's own workspace-member id. */
const CURRENT_USER_OPERANDS: ReadonlySet<string> = new Set([ViewFilterOperand.IS, ViewFilterOperand.IS_NOT]);

function ValueControl({
  field,
  condition,
  onChange,
}: {
  field: DataModelField | undefined;
  condition: RowLevelPermissionCondition;
  onChange: (patch: Partial<RowLevelPermissionCondition>) => void;
}) {
  if (!field || NO_VALUE_OPERANDS.has(condition.operand)) return null;
  if (condition.valueMode === 'CURRENT_USER') {
    return <span className="px-2 text-sm text-muted-foreground">current user</span>;
  }

  if (field.type === FieldMetadataType.RELATION) {
    return (
      <div className="w-56">
        <RelationPickerInput
          field={field}
          value={(condition.value as string) ?? null}
          onChange={(v) => onChange({ value: v })}
        />
      </div>
    );
  }

  if (field.type === FieldMetadataType.BOOLEAN) {
    return (
      <Select value={String(condition.value ?? 'true')} onValueChange={(v) => onChange({ value: v === 'true' })}>
        <SelectTrigger className="w-28">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="true">Yes</SelectItem>
          <SelectItem value="false">No</SelectItem>
        </SelectContent>
      </Select>
    );
  }

  if (field.type === FieldMetadataType.SELECT) {
    const options = (field.settings?.options as SelectOption[] | undefined) ?? [];
    return (
      <Select value={(condition.value as string) ?? undefined} onValueChange={(v) => onChange({ value: v })}>
        <SelectTrigger className="w-40">
          <SelectValue placeholder="Value…" />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (field.type === FieldMetadataType.DATE || field.type === FieldMetadataType.DATE_TIME) {
    return (
      <Input
        type={field.type === FieldMetadataType.DATE ? 'date' : 'datetime-local'}
        className="w-48"
        value={(condition.value as string) ?? ''}
        onChange={(e) => onChange({ value: e.target.value })}
      />
    );
  }

  return (
    <Input
      className="w-40"
      value={(condition.value as string) ?? ''}
      onChange={(e) =>
        onChange({ value: field.type === FieldMetadataType.NUMBER ? Number(e.target.value) : e.target.value })
      }
    />
  );
}

/**
 * Editor for a role+object's row-level permission rule: a flat, ordered list of `<field> <operand>
 * <value>` conditions joined by each condition's own AND/OR (no nested groups — v1 scope, matches
 * apps/api/src/lib/query-parser.ts's `applyLogicalConditions`). A condition's value can be a
 * literal or "current user" (resolved against the caller's workspace member at query time), the
 * latter only for the `is`/`is not` operators.
 */
export function RowLevelPermissionBuilder({
  fields,
  conditions,
  onChange,
}: {
  fields: DataModelField[];
  conditions: RowLevelPermissionCondition[];
  onChange: (conditions: RowLevelPermissionCondition[]) => void;
}) {
  const filterableFields = fields.filter((f) => FILTERABLE_TYPES.has(f.type));
  const fieldById = new Map(filterableFields.map((f) => [f.id, f]));

  function updateAt(index: number, patch: Partial<RowLevelPermissionCondition>): void {
    onChange(conditions.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  }

  function addCondition(): void {
    const first = filterableFields[0];
    if (!first) return;
    onChange([
      ...conditions,
      { fieldMetadataId: first.id, operand: operandsForType(first.type)[0]!, valueMode: 'LITERAL', logicalOperator: 'AND' },
    ]);
  }

  function removeAt(index: number): void {
    onChange(conditions.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-2">
      {conditions.map((condition, index) => {
        const field = fieldById.get(condition.fieldMetadataId);
        const availableOperands = field ? operandsForType(field.type) : [];
        const canUseCurrentUser = CURRENT_USER_OPERANDS.has(condition.operand);

        return (
          <div key={index} className="flex flex-wrap items-center gap-2">
            {index === 0 ? (
              <span className="w-12 shrink-0 text-xs text-muted-foreground">Where</span>
            ) : (
              <Select
                value={condition.logicalOperator}
                onValueChange={(v) => v && updateAt(index, { logicalOperator: v as 'AND' | 'OR' })}
              >
                <SelectTrigger className="w-16">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="AND">And</SelectItem>
                  <SelectItem value="OR">Or</SelectItem>
                </SelectContent>
              </Select>
            )}

            <Select
              value={condition.fieldMetadataId}
              onValueChange={(id) => {
                if (!id) return;
                const next = fieldById.get(id);
                updateAt(index, {
                  fieldMetadataId: id,
                  operand: next ? operandsForType(next.type)[0] : undefined,
                  value: undefined,
                  valueMode: 'LITERAL',
                });
              }}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {filterableFields.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={condition.operand}
              onValueChange={(operand) =>
                operand &&
                updateAt(index, {
                  operand,
                  value: undefined,
                  valueMode: CURRENT_USER_OPERANDS.has(operand) ? condition.valueMode : 'LITERAL',
                })
              }
            >
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableOperands.map((op) => (
                  <SelectItem key={op} value={op}>
                    {OPERAND_LABELS[op] ?? op}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {canUseCurrentUser && (
              <Select
                value={condition.valueMode}
                onValueChange={(mode) =>
                  mode && updateAt(index, { valueMode: mode as 'LITERAL' | 'CURRENT_USER', value: undefined })
                }
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LITERAL">a specific value</SelectItem>
                  <SelectItem value="CURRENT_USER">current user</SelectItem>
                </SelectContent>
              </Select>
            )}

            <ValueControl field={field} condition={condition} onChange={(patch) => updateAt(index, patch)} />

            <Button variant="ghost" size="sm" onClick={() => removeAt(index)}>
              Remove
            </Button>
          </div>
        );
      })}
      <Button variant="outline" size="sm" onClick={addCondition}>
        + Add condition
      </Button>
    </div>
  );
}
