import { FieldMetadataType, ViewFilterOperand, type SelectOption } from '@saasly/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { DataModelField } from '@/lib/api-client';
import { FILTERABLE_TYPES, friendlyFieldKey, operandsForType } from '../lib/field-values';
import { RelationPickerInput } from './RelationPickerInput';

export interface FilterCondition {
  field: string; // friendly key, matches record-list query's `field`
  operand: string;
  value?: unknown;
}

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

function ValueInput({
  field,
  condition,
  onChange,
}: {
  field: DataModelField | undefined;
  condition: FilterCondition;
  onChange: (value: unknown) => void;
}) {
  if (!field || NO_VALUE_OPERANDS.has(condition.operand)) return null;

  if (field.type === FieldMetadataType.RELATION) {
    // Pick a real target record (stores its id) instead of hand-typing a UUID — the backend
    // filters the `<field>Id` FK column by equality, so id-selection works end-to-end (gap B2).
    return (
      <div className="w-56">
        <RelationPickerInput
          field={field}
          value={(condition.value as string) ?? null}
          onChange={(v) => onChange(v)}
        />
      </div>
    );
  }

  if (field.type === FieldMetadataType.BOOLEAN) {
    return (
      <Select value={String(condition.value ?? 'true')} onValueChange={(v) => onChange(v === 'true')}>
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
      <Select value={(condition.value as string) ?? undefined} onValueChange={onChange}>
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
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  return (
    <Input
      className="w-40"
      value={(condition.value as string) ?? ''}
      onChange={(e) => onChange(field.type === FieldMetadataType.NUMBER ? Number(e.target.value) : e.target.value)}
    />
  );
}

export function FilterBar({
  fields,
  conditions,
  onChange,
}: {
  fields: DataModelField[];
  conditions: FilterCondition[];
  onChange: (conditions: FilterCondition[]) => void;
}) {
  const filterableFields = fields.filter((f) => FILTERABLE_TYPES.has(f.type));
  const fieldByKey = new Map(filterableFields.map((f) => [friendlyFieldKey(f), f]));

  function updateAt(index: number, patch: Partial<FilterCondition>): void {
    onChange(conditions.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  }

  function addCondition(): void {
    const first = filterableFields[0];
    if (!first) return;
    onChange([...conditions, { field: friendlyFieldKey(first), operand: operandsForType(first.type)[0]! }]);
  }

  function removeAt(index: number): void {
    onChange(conditions.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-2">
      {conditions.map((condition, index) => {
        const field = fieldByKey.get(condition.field);
        return (
          <div key={index} className="flex items-center gap-2">
            <Select
              value={condition.field}
              onValueChange={(key) => {
                if (!key) return;
                const next = fieldByKey.get(key);
                updateAt(index, { field: key, operand: next ? operandsForType(next.type)[0] : undefined, value: undefined });
              }}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {filterableFields.map((f) => (
                  <SelectItem key={f.id} value={friendlyFieldKey(f)}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={condition.operand}
              onValueChange={(operand) => operand && updateAt(index, { operand, value: undefined })}
            >
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(field ? operandsForType(field.type) : []).map((op) => (
                  <SelectItem key={op} value={op}>
                    {OPERAND_LABELS[op] ?? op}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <ValueInput field={field} condition={condition} onChange={(value) => updateAt(index, { value })} />

            <Button variant="ghost" size="sm" onClick={() => removeAt(index)}>
              Remove
            </Button>
          </div>
        );
      })}
      <Button variant="outline" size="sm" onClick={addCondition}>
        + Add filter
      </Button>
    </div>
  );
}
