import { useQueries, useQuery } from '@tanstack/react-query';
import { WorkflowActionType, WorkflowTriggerType, type WorkflowStep, type WorkflowTrigger } from '@saasly/shared';
import { dataModelApi, type DataModelField } from '@/lib/api-client';
import { recordActionFields, recordFieldKey } from '../components/steps/record-fields';

/**
 * One selectable field on a step's output. `key` is the path segment relative to its PARENT (not the
 * full `{{...}}` path) — the picker joins segments as it drills. `fields` lets a leaf drill further
 * (e.g. a Search step's "First <Object>" nests that object's own fields), so the picker supports
 * arbitrary depth of nested output-schema navigation.
 */
export interface StepSourceField {
  key: string;
  label: string;
  type: string;
  description?: string;
  fields?: StepSourceField[];
}

/** A step (or the trigger) the variable/field picker can drill into. */
export interface ConditionStepSource {
  id: string; // context key: 'trigger' or a step id
  label: string;
  fields?: StepSourceField[];
}

function objectFieldsToSource(fields: DataModelField[]): StepSourceField[] {
  return recordActionFields(fields).map((f) => ({ key: recordFieldKey(f), label: f.label, type: f.type }));
}

/** Object fields for a named object (record-bearing triggers/actions). */
export function useObjectFields(objectName: string | undefined): StepSourceField[] {
  const { data: objects } = useQuery({ queryKey: ['data-model-objects'], queryFn: dataModelApi.listObjects });
  const objectId = objectName ? objects?.find((o) => o.nameSingular === objectName)?.id : undefined;
  const { data: detail } = useQuery({
    queryKey: ['data-model-object', objectId],
    queryFn: () => dataModelApi.getObject(objectId!),
    enabled: !!objectId,
  });
  if (!detail) return [];
  return objectFieldsToSource(detail.fields);
}

/** Parse a sample-JSON textarea (HTTP/webhook expected body, Code expected output) into field sources. */
function fieldsFromJsonSample(sample: string | undefined): StepSourceField[] {
  if (!sample) return [];
  try {
    const parsed: unknown = JSON.parse(sample);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return Object.entries(parsed as Record<string, unknown>).map(([key, value]) => ({
        key,
        label: key,
        type: typeof value === 'number' ? 'NUMBER' : typeof value === 'boolean' ? 'BOOLEAN' : 'TEXT',
      }));
    }
  } catch {
    /* ignore invalid sample JSON — the picker just won't offer fields for this step yet */
  }
  return [];
}

const STATIC_FIELDS: Partial<Record<string, StepSourceField[]>> = {
  [WorkflowActionType.FILTER]: [{ key: 'passed', label: 'Passed', type: 'BOOLEAN' }],
  [WorkflowActionType.IF_ELSE]: [{ key: 'matched', label: 'Matched branch', type: 'TEXT' }],
  [WorkflowActionType.ITERATOR]: [
    { key: 'count', label: 'Item count', type: 'NUMBER' },
    { key: 'failedIterations', label: 'Failed iterations', type: 'NUMBER' },
  ],
  [WorkflowActionType.DELAY]: [{ key: 'waitedMs', label: 'Waited (ms)', type: 'NUMBER' }],
  [WorkflowActionType.SEND_EMAIL]: [
    { key: 'to', label: 'To', type: 'TEXT' },
    { key: 'subject', label: 'Subject', type: 'TEXT' },
    { key: 'sent', label: 'Sent', type: 'BOOLEAN' },
  ],
  [WorkflowActionType.DELETE_RECORD]: [{ key: 'deletedId', label: 'Deleted ID', type: 'UUID' }],
};

const RECORD_ACTION_TYPES: ReadonlySet<string> = new Set([
  WorkflowActionType.CREATE_RECORD,
  WorkflowActionType.UPDATE_RECORD,
  WorkflowActionType.UPSERT_RECORD,
  WorkflowActionType.FIND_RECORDS,
]);

/**
 * Build the picker sources for every step preceding `currentStepId` (+ the trigger). Each source
 * exposes the known output fields for its type — record fields for record actions (from object
 * metadata), a small static schema for flow/core actions, and fields parsed out of the "Expected
 * output body" sample for CODE/HTTP_REQUEST (a sample response is
 * how the variable picker learns an otherwise-arbitrary step's shape). Used for BOTH the left
 * (field-to-compare) and right (value/variable) sides of the condition builder, and for every
 * VariableInput in the drawer.
 */
export function useStepSources(
  trigger: WorkflowTrigger | null,
  steps: WorkflowStep[],
  currentStepId: string,
): ConditionStepSource[] {
  const priorSteps = steps.filter((s) => s.id !== currentStepId);

  const { data: objects } = useQuery({ queryKey: ['data-model-objects'], queryFn: dataModelApi.listObjects });
  const recordSteps = priorSteps.filter((s) => RECORD_ACTION_TYPES.has(s.type));
  const objectQueries = useQueries({
    queries: recordSteps.map((s) => {
      const objectName = (s.settings?.input as Record<string, unknown> | undefined)?.objectName as string | undefined;
      const objectId = objectName ? objects?.find((o) => o.nameSingular === objectName)?.id : undefined;
      return {
        queryKey: ['data-model-object', objectId],
        queryFn: () => dataModelApi.getObject(objectId!),
        enabled: !!objectId,
      };
    }),
  });
  const objectByStepId = new Map<string, { fields: StepSourceField[]; labelSingular: string; labelPlural: string }>();
  recordSteps.forEach((s, i) => {
    const data = objectQueries[i]?.data;
    objectByStepId.set(s.id, {
      fields: data ? objectFieldsToSource(data.fields) : [],
      labelSingular: data?.object.labelSingular ?? 'Record',
      labelPlural: data?.object.labelPlural ?? 'Records',
    });
  });

  const triggerObjectName =
    trigger?.type === WorkflowTriggerType.DATABASE_EVENT ? (trigger.settings?.objectName as string | undefined) : undefined;
  const triggerObjectFields = useObjectFields(triggerObjectName);

  const sources: ConditionStepSource[] = [];

  if (trigger) {
    let fields: StepSourceField[] | undefined;
    if (trigger.type === WorkflowTriggerType.DATABASE_EVENT) {
      fields = [
        { key: 'operation', label: 'Operation', type: 'TEXT' },
        { key: 'record', label: 'Record', type: 'RECORD', fields: triggerObjectFields },
      ];
    } else if (trigger.type === WorkflowTriggerType.WEBHOOK) {
      fields = fieldsFromJsonSample(trigger.settings?.expectedBody as string | undefined);
    } else if (trigger.type === WorkflowTriggerType.CRON) {
      fields = [{ key: 'firedAt', label: 'Fired at', type: 'TEXT' }];
    }
    sources.push({ id: 'trigger', label: trigger.name || 'Trigger', fields });
  }

  for (const s of priorSteps) {
    let fields: StepSourceField[] | undefined;
    switch (s.type) {
      case WorkflowActionType.CREATE_RECORD:
      case WorkflowActionType.UPDATE_RECORD:
      case WorkflowActionType.UPSERT_RECORD: {
        const obj = objectByStepId.get(s.id);
        fields = [
          { key: 'id', label: 'ID', type: 'UUID' },
          { key: 'record', label: 'Record', type: 'RECORD', fields: obj?.fields ?? [] },
        ];
        break;
      }
      case WorkflowActionType.FIND_RECORDS: {
        const obj = objectByStepId.get(s.id);
        fields = [
          {
            key: 'first',
            label: `First ${obj?.labelSingular ?? 'Record'}`,
            type: 'RECORD',
            description: 'A single matching record',
            fields: [{ key: 'id', label: 'ID', type: 'UUID' }, ...(obj?.fields ?? [])],
          },
          {
            key: 'records',
            label: `All ${obj?.labelPlural ?? 'Records'}`,
            type: 'ARRAY',
            description: 'Returns an array of records',
          },
          { key: 'count', label: 'Total Count', type: 'NUMBER', description: 'Count of matching records' },
        ];
        break;
      }
      case WorkflowActionType.CODE: {
        const sample = (s.settings?.input as Record<string, unknown> | undefined)?.expectedOutputBody as string | undefined;
        fields = fieldsFromJsonSample(sample);
        break;
      }
      case WorkflowActionType.HTTP_REQUEST: {
        const sample = (s.settings?.input as Record<string, unknown> | undefined)?.expectedOutputBody as string | undefined;
        fields = [
          { key: 'status', label: 'Status', type: 'NUMBER' },
          { key: 'ok', label: 'OK', type: 'BOOLEAN' },
          { key: 'body', label: 'Response body', type: 'OBJECT', fields: fieldsFromJsonSample(sample) },
        ];
        break;
      }
      case WorkflowActionType.FORM: {
        const formFields =
          ((s.settings?.input as Record<string, unknown> | undefined)?.fields as
            | { name: string; label: string; type: string }[]
            | undefined) ?? [];
        fields = formFields.map((f) => ({ key: f.name, label: f.label, type: f.type }));
        break;
      }
      default:
        fields = STATIC_FIELDS[s.type];
    }
    sources.push({ id: s.id, label: s.name, fields });
  }

  return sources;
}

/**
 * Resolve a `{{stepId.a.b.c}}` template back to a friendly "Step · A · B · C" label by walking the
 * same nested `fields` structure the picker uses — recursing through every `fields` level so nested
 * drills (e.g. a Search step's "First Company · Name") render as readable breadcrumbs instead of a
 * raw path. Returns `null` when `template` isn't a single whole-string variable (mixed text, a
 * literal, or empty) — callers use that to decide between "chip" and "plain text" rendering.
 */
export function resolveVariableLabel(sources: ConditionStepSource[], template: string): string | null {
  const m = /^\{\{([^{}]+)\}\}$/.exec(template.trim());
  if (!m) return null;
  const path = m[1]!.split('.');
  const stepId = path[0]!;
  const source = sources.find((s) => s.id === stepId);
  if (!source) return path.join(' · ');

  let label = source.label;
  let fields: StepSourceField[] | undefined = source.fields;
  let remaining = path.slice(1);

  while (remaining.length > 0) {
    if (!fields) {
      label += ` · ${remaining.join('.')}`;
      break;
    }
    // Keys can themselves contain dots (legacy flat entries) — try the longest match first.
    let matched: StepSourceField | undefined;
    let consumed = 0;
    for (let n = remaining.length; n >= 1; n--) {
      const candidate = remaining.slice(0, n).join('.');
      const found = fields.find((f) => f.key === candidate);
      if (found) {
        matched = found;
        consumed = n;
        break;
      }
    }
    if (!matched) {
      label += ` · ${remaining.join('.')}`;
      break;
    }
    label += ` · ${matched.label}`;
    remaining = remaining.slice(consumed);
    fields = matched.fields;
  }
  return label;
}
