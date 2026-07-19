import { useState } from 'react';
import { Braces, X } from 'lucide-react';
import { FieldMetadataType, toCamelCase } from '@saasly/shared';
import { Button } from '@/components/ui/button';
import { FieldInput, isEditableField } from '@/features/objects/lib/field-inputs';
import type { DataModelField } from '@/lib/api-client';
import { VariableInput } from './fields';
import type { ConditionStepSource } from '../../lib/step-sources';

/**
 * The key a field's value is stored/read under in a workflow record action's `objectRecord` map — and
 * the key the decoded record shape uses (`record-codec.ts#decodeRecord`, both api and worker copies).
 * A forward RELATION field named e.g. "company" decodes to `companyId` (the fk column), not `company`
 * — using the bare camelCase name here silently dropped every relation value written by a workflow.
 */
export function recordFieldKey(field: DataModelField): string {
  const camel = toCamelCase(field.name);
  return field.type === FieldMetadataType.RELATION ? `${camel}Id` : camel;
}

/**
 * A record-field value input that can hold either a literal (rendered with the CRM's own per-type
 * `FieldInput`, so every field type gets its proper editor — Twenty's approach) OR a `{{...}}` variable
 * from a previous step (toggled by the {x} button). Variable mode is detected by a leading `{{`.
 */
export function RecordFieldValueInput({
  field,
  value,
  onChange,
  sources,
}: {
  field: DataModelField;
  value: unknown;
  onChange: (value: unknown) => void;
  sources: ConditionStepSource[];
}) {
  const isVariableValue = typeof value === 'string' && value.trim().startsWith('{{');
  const [variableMode, setVariableMode] = useState(isVariableValue);

  return (
    <div className="flex items-start gap-1">
      <div className="min-w-0 flex-1">
        {variableMode ? (
          <VariableInput
            value={typeof value === 'string' ? value : ''}
            onChange={onChange}
            sources={sources}
            placeholder="{{trigger.record.field}}"
          />
        ) : (
          <FieldInput field={field} value={value} onChange={onChange} />
        )}
      </div>
      <Button
        type="button"
        variant={variableMode ? 'secondary' : 'ghost'}
        size="icon-xs"
        aria-label={variableMode ? 'Use a value' : 'Use a variable'}
        onClick={() => {
          setVariableMode((m) => !m);
          onChange(variableMode ? null : '');
        }}
      >
        {variableMode ? <X className="size-3.5" /> : <Braces className="size-3.5" />}
      </Button>
    </div>
  );
}

/** Editable fields for a workflow record action, excluding system/audit fields. */
export function recordActionFields(fields: DataModelField[]): DataModelField[] {
  return fields.filter(
    (f) =>
      f.isActive &&
      isEditableField(f) &&
      f.type !== FieldMetadataType.RICH_TEXT && // BlockNote editor isn't useful in the builder drawer
      !['created_by', 'updated_by', 'position', 'search_vector'].includes(f.name),
  );
}
