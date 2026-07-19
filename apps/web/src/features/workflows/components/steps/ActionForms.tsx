import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Play, Plus, Trash2 } from 'lucide-react';
import {
  WorkflowActionType,
  inferCodeParams,
  toCamelCase,
  type StepFilter,
  type StepFilterGroup,
  type WorkflowStep,
  type WorkflowTrigger,
} from '@saasly/shared';
import { dataModelApi, workflowApi, type DataModelField } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Field, VariableInput } from './fields';
import { RecordFieldValueInput, recordActionFields, recordFieldKey } from './record-fields';
import { ConditionBuilder } from './ConditionBuilder';
import { useObjectFields, useStepSources, type ConditionStepSource } from '../../lib/step-sources';
import { newId } from '../../lib/id';

interface Props {
  step: WorkflowStep;
  steps: WorkflowStep[];
  trigger: WorkflowTrigger | null;
  onChange: (step: WorkflowStep) => void;
}

type Input = Record<string, unknown>;

function getInput(step: WorkflowStep): Input {
  return (step.settings?.input ?? {}) as Input;
}
function setInput(step: WorkflowStep, patch: Input): WorkflowStep {
  return { ...step, settings: { ...step.settings, input: { ...getInput(step), ...patch } } };
}

export function ActionForm({ step, steps, trigger, onChange }: Props) {
  const sources = useStepSources(trigger, steps, step.id);
  const t = WorkflowActionType;
  switch (step.type) {
    case t.CREATE_RECORD:
    case t.UPDATE_RECORD:
    case t.UPSERT_RECORD:
      return <RecordWriteForm step={step} onChange={onChange} sources={sources} />;
    case t.DELETE_RECORD:
      return <DeleteRecordForm step={step} onChange={onChange} sources={sources} />;
    case t.FIND_RECORDS:
      return <FindRecordsForm step={step} onChange={onChange} sources={sources} />;
    case t.FILTER:
    case t.IF_ELSE:
      return <ConditionForm step={step} sources={sources} onChange={onChange} isBranching={step.type === t.IF_ELSE} />;
    case t.ITERATOR:
      return <IteratorForm step={step} onChange={onChange} sources={sources} />;
    case t.DELAY:
      return <DelayForm step={step} onChange={onChange} />;
    case t.SEND_EMAIL:
      return <SendEmailForm step={step} onChange={onChange} sources={sources} />;
    case t.HTTP_REQUEST:
      return <HttpRequestForm step={step} onChange={onChange} sources={sources} />;
    case t.FORM:
      return <FormActionForm step={step} onChange={onChange} />;
    case t.CODE:
      return <CodeForm step={step} onChange={onChange} sources={sources} />;
    default:
      return null;
  }
}

function useObjects() {
  return useQuery({ queryKey: ['data-model-objects'], queryFn: dataModelApi.listObjects });
}

function ObjectSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { data: objects } = useObjects();
  return (
    <Select value={value || undefined} onValueChange={(v) => v && onChange(v)}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Select an object" />
      </SelectTrigger>
      <SelectContent>
        {objects?.filter((o) => o.isActive).map((o) => (
          <SelectItem key={o.id} value={o.nameSingular}>
            {o.labelSingular}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ── record write (create / update / upsert) ───────────────────────────────────
function RecordWriteForm({ step, onChange, sources }: { step: WorkflowStep; onChange: (s: WorkflowStep) => void; sources: ConditionStepSource[] }) {
  const input = getInput(step);
  const objectName = (input.objectName as string) ?? '';
  const objectRecord = (input.objectRecord as Record<string, unknown>) ?? {};
  const isUpdate = step.type === WorkflowActionType.UPDATE_RECORD;
  const isUpsert = step.type === WorkflowActionType.UPSERT_RECORD;

  const { data: objects } = useObjects();
  const objectId = objects?.find((o) => o.nameSingular === objectName)?.id;
  const { data: detail } = useQuery({
    queryKey: ['data-model-object', objectId],
    queryFn: () => dataModelApi.getObject(objectId!),
    enabled: !!objectId,
  });
  const fields = detail ? recordActionFields(detail.fields) : [];
  const uniqueFieldName = (input.uniqueFieldName as string) ?? 'id';

  const setRecordField = (name: string, value: unknown) => {
    const next = { ...objectRecord };
    if (value === null || value === undefined || value === '') delete next[name];
    else next[name] = value;
    onChange({ ...setInput(step, { objectRecord: next }), valid: !!objectName });
  };

  return (
    <div className="flex flex-col gap-4">
      <Field label="Object">
        <ObjectSelect value={objectName} onChange={(v) => onChange({ ...setInput(step, { objectName: v }), valid: true })} />
      </Field>

      {isUpsert && objectName && (
        <Field label="Unique field" hint="If a record matches on this field it's updated, otherwise created.">
          <Select value={uniqueFieldName} onValueChange={(v) => v && onChange(setInput(step, { uniqueFieldName: v }))}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="id">ID</SelectItem>
              {fields
                .filter((f) => f.isUnique && f.type === 'TEXT')
                .map((f) => (
                  <SelectItem key={f.id} value={toCamelCase(f.name)}>
                    {f.label}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </Field>
      )}

      {(isUpdate || isUpsert) && (
        <Field
          label={isUpsert ? 'Match value' : 'Record ID'}
          hint={isUpsert ? 'The value to match on the unique field.' : 'The id of the record to update — usually a variable.'}
        >
          <VariableInput
            value={(input.objectRecordId as string) ?? ''}
            onChange={(v) => onChange(setInput(step, { objectRecordId: v }))}
            sources={sources}
            placeholder="{{trigger.record.id}}"
          />
        </Field>
      )}

      {objectName &&
        (isUpdate ? (
          <UpdateFieldsEditor
            fields={fields}
            selected={(input.fieldsToUpdate as string[]) ?? []}
            objectRecord={objectRecord}
            sources={sources}
            onSelectedChange={(next) => onChange(setInput(step, { fieldsToUpdate: next }))}
            onValueChange={setRecordField}
          />
        ) : (
          <div className="flex flex-col gap-3">
            <div className="text-xs font-medium text-muted-foreground">Fields</div>
            {fields.length === 0 && <p className="text-xs text-muted-foreground">Loading fields…</p>}
            {fields.map((f) => (
              <Field key={f.id} label={f.label}>
                <RecordFieldValueInput
                  field={f}
                  value={objectRecord[recordFieldKey(f)]}
                  onChange={(v) => setRecordField(recordFieldKey(f), v)}
                  sources={sources}
                />
              </Field>
            ))}
          </div>
        ))}
    </div>
  );
}

/** Update-record: pick which fields to change ("Fields to update"), then edit only those. */
function UpdateFieldsEditor({
  fields,
  selected,
  objectRecord,
  sources,
  onSelectedChange,
  onValueChange,
}: {
  fields: DataModelField[];
  selected: string[];
  objectRecord: Record<string, unknown>;
  sources: ConditionStepSource[];
  onSelectedChange: (next: string[]) => void;
  onValueChange: (name: string, value: unknown) => void;
}) {
  const remaining = fields.filter((f) => !selected.includes(recordFieldKey(f)));
  const fieldByKey = (key: string) => fields.find((f) => recordFieldKey(f) === key);

  return (
    <div className="flex flex-col gap-3">
      <div className="text-xs font-medium text-muted-foreground">Fields to update</div>
      {selected.map((key) => {
        const f = fieldByKey(key);
        if (!f) return null;
        return (
          <Field key={key} label={f.label}>
            <div className="flex items-start gap-1">
              <div className="min-w-0 flex-1">
                <RecordFieldValueInput
                  field={f}
                  value={objectRecord[key]}
                  onChange={(v) => onValueChange(key, v)}
                  sources={sources}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label="Remove field"
                onClick={() => {
                  onSelectedChange(selected.filter((k) => k !== key));
                  onValueChange(key, null);
                }}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          </Field>
        );
      })}
      {remaining.length > 0 && (
        <Select value="" onValueChange={(v) => v && onSelectedChange([...selected, v])}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="+ Add a field to update" />
          </SelectTrigger>
          <SelectContent>
            {remaining.map((f) => (
              <SelectItem key={f.id} value={recordFieldKey(f)}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}

function DeleteRecordForm({ step, onChange, sources }: { step: WorkflowStep; onChange: (s: WorkflowStep) => void; sources: ConditionStepSource[] }) {
  const input = getInput(step);
  return (
    <div className="flex flex-col gap-4">
      <Field label="Object">
        <ObjectSelect value={(input.objectName as string) ?? ''} onChange={(v) => onChange({ ...setInput(step, { objectName: v }), valid: true })} />
      </Field>
      <Field label="Record ID">
        <VariableInput
          value={(input.objectRecordId as string) ?? ''}
          onChange={(v) => onChange(setInput(step, { objectRecordId: v }))}
          sources={sources}
          placeholder="{{trigger.record.id}}"
        />
      </Field>
    </div>
  );
}

function FindRecordsForm({ step, onChange, sources }: { step: WorkflowStep; onChange: (s: WorkflowStep) => void; sources: ConditionStepSource[] }) {
  const input = getInput(step);
  const objectName = (input.objectName as string) ?? '';
  const objFields = useObjectFields(objectName);
  const filterLeftSources: ConditionStepSource[] = objectName ? [{ id: 'record', label: 'Record field', fields: objFields }] : [];
  const filter = (input.filter as { stepFilters?: StepFilter[]; stepFilterGroups?: StepFilterGroup[] } | undefined) ?? {};
  const sort = (input.sort as { field?: string; direction?: string } | null) ?? null;

  return (
    <div className="flex flex-col gap-4">
      <Field label="Object">
        <ObjectSelect value={objectName} onChange={(v) => onChange({ ...setInput(step, { objectName: v }), valid: true })} />
      </Field>

      {objectName && (
        <Field label="Filter (optional)" hint="Only matching records are returned.">
          <ConditionBuilder
            value={{ stepFilters: filter.stepFilters ?? [], stepFilterGroups: filter.stepFilterGroups ?? [] }}
            steps={filterLeftSources}
            sources={sources}
            onChange={(v) => onChange(setInput(step, { filter: v }))}
          />
        </Field>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Field label="Sort field">
          <Select
            value={sort?.field ?? '__none__'}
            onValueChange={(v) => onChange(setInput(step, { sort: v === '__none__' ? null : { field: v, direction: sort?.direction ?? 'ASC' } }))}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="No sort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">No sort</SelectItem>
              <SelectItem value="createdAt">Created at</SelectItem>
              <SelectItem value="updatedAt">Updated at</SelectItem>
              {objFields.map((f) => (
                <SelectItem key={f.key} value={f.key}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Direction">
          <Select
            value={sort?.direction ?? 'ASC'}
            onValueChange={(v) => v && sort?.field && onChange(setInput(step, { sort: { field: sort.field, direction: v } }))}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ASC">Ascending</SelectItem>
              <SelectItem value="DESC">Descending</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Field label="Limit">
          <Input
            type="number"
            min={1}
            value={String((input.limit as number) ?? 20)}
            onChange={(e) => onChange(setInput(step, { limit: Number(e.target.value) || 20 }))}
          />
        </Field>
        <Field label="Offset">
          <Input
            type="number"
            min={0}
            value={String((input.offset as number) ?? 0)}
            onChange={(e) => onChange(setInput(step, { offset: Number(e.target.value) || 0 }))}
          />
        </Field>
      </div>
    </div>
  );
}

// ── condition builder (filter / if-else) ──────────────────────────────────────
function ConditionForm({
  step,
  sources,
  onChange,
  isBranching,
}: {
  step: WorkflowStep;
  sources: ConditionStepSource[];
  onChange: (s: WorkflowStep) => void;
  isBranching: boolean;
}) {
  const input = getInput(step);

  return (
    <div className="flex flex-col gap-4">
      {isBranching && (
        <p className="text-[11px] text-muted-foreground">
          When the condition holds the True branch runs, otherwise the False branch. Use the + on this
          node to add steps to each branch.
        </p>
      )}
      <ConditionBuilder
        value={{
          stepFilters: (input.stepFilters as StepFilter[]) ?? [],
          stepFilterGroups: (input.stepFilterGroups as StepFilterGroup[]) ?? [],
        }}
        steps={sources}
        sources={sources}
        onChange={(v) =>
          onChange({ ...setInput(step, { stepFilters: v.stepFilters, stepFilterGroups: v.stepFilterGroups }), valid: v.stepFilters.length > 0 })
        }
      />
    </div>
  );
}

function IteratorForm({ step, onChange, sources }: { step: WorkflowStep; onChange: (s: WorkflowStep) => void; sources: ConditionStepSource[] }) {
  const input = getInput(step);
  const continueOnFail = input.shouldContinueOnIterationFailure === true;
  return (
    <div className="flex flex-col gap-4">
      <Field label="Items" hint="A variable resolving to an array — the loop body runs once per item.">
        <VariableInput
          value={(input.items as string) ?? ''}
          onChange={(v) => onChange({ ...setInput(step, { items: v }), valid: !!v })}
          sources={sources}
          placeholder="{{some-step.records}}"
        />
      </Field>
      <label className="flex items-center justify-between">
        <span className="text-sm">Continue on iteration failure</span>
        <Switch
          checked={continueOnFail}
          onCheckedChange={(v) => onChange(setInput(step, { shouldContinueOnIterationFailure: v }))}
        />
      </label>
      <p className="text-[11px] text-muted-foreground">Use the + on this node to add steps to the loop body.</p>
    </div>
  );
}

function DelayForm({ step, onChange }: { step: WorkflowStep; onChange: (s: WorkflowStep) => void }) {
  const input = getInput(step);
  return (
    <div className="flex flex-col gap-4">
      <Field label="Wait for">
        <div className="flex gap-2">
          <Input
            type="number"
            min={1}
            className="w-24"
            value={String((input.duration as number) ?? 1)}
            onChange={(e) => onChange({ ...setInput(step, { duration: Number(e.target.value) || 1 }), valid: true })}
          />
          <Select value={(input.unit as string) ?? 'MINUTES'} onValueChange={(v) => onChange({ ...setInput(step, { unit: v }), valid: true })}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="SECONDS">Seconds</SelectItem>
              <SelectItem value="MINUTES">Minutes</SelectItem>
              <SelectItem value="HOURS">Hours</SelectItem>
              <SelectItem value="DAYS">Days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Field>
    </div>
  );
}

function SendEmailForm({ step, onChange, sources }: { step: WorkflowStep; onChange: (s: WorkflowStep) => void; sources: ConditionStepSource[] }) {
  const input = getInput(step);
  const set = (patch: Input) => {
    const next = { ...getInput(step), ...patch };
    onChange({ ...setInput(step, patch), valid: !!next.to && !!next.subject });
  };
  return (
    <div className="flex flex-col gap-4">
      <Field label="To">
        <VariableInput value={(input.to as string) ?? ''} onChange={(v) => set({ to: v })} sources={sources} placeholder="{{trigger.record.email}}" />
      </Field>
      <Field label="Subject">
        <VariableInput value={(input.subject as string) ?? ''} onChange={(v) => set({ subject: v })} sources={sources} />
      </Field>
      <Field label="Body">
        <VariableInput value={(input.body as string) ?? ''} onChange={(v) => set({ body: v })} sources={sources} multiline />
      </Field>
    </div>
  );
}

/** Key/value editor (HTTP headers) — always keeps a trailing empty row; stores as Record<string,string>. */
function KeyValueEditor({
  value,
  onChange,
}: {
  value: Record<string, string>;
  onChange: (v: Record<string, string>) => void;
}) {
  const rows = [...Object.entries(value), ['', ''] as [string, string]];
  const commit = (next: [string, string][]) =>
    onChange(Object.fromEntries(next.filter(([k]) => k.trim() !== '')));
  return (
    <div className="flex flex-col gap-1.5">
      {rows.map(([k, v], i) => (
        <div key={i} className="flex items-center gap-1">
          <Input
            className="flex-1"
            placeholder="Header"
            value={k}
            onChange={(e) => {
              const next = rows.slice(0, -1) as [string, string][];
              if (i < next.length) next[i] = [e.target.value, v];
              else next.push([e.target.value, v]);
              commit(next);
            }}
          />
          <Input
            className="flex-1"
            placeholder="Value"
            value={v}
            onChange={(e) => {
              const next = rows.slice(0, -1) as [string, string][];
              if (i < next.length) next[i] = [k, e.target.value];
              else next.push([k, e.target.value]);
              commit(next);
            }}
          />
        </div>
      ))}
    </div>
  );
}

function HttpRequestForm({ step, onChange, sources }: { step: WorkflowStep; onChange: (s: WorkflowStep) => void; sources: ConditionStepSource[] }) {
  const input = getInput(step);
  const method = (input.method as string) ?? 'POST';
  const bodyType = (input.bodyType as string) ?? 'rawJson';
  const hasBody = method === 'POST' || method === 'PUT' || method === 'PATCH';
  const set = (patch: Input) => onChange({ ...setInput(step, patch), valid: !!{ ...getInput(step), ...patch }.url });

  const test = useMutation({
    mutationFn: () =>
      workflowApi.testHttp({
        url: input.url as string,
        method,
        headers: (input.headers as Record<string, string>) ?? {},
        body: hasBody && bodyType !== 'none' ? (input.body as string) : undefined,
      }),
  });

  return (
    <Tabs defaultValue="config">
      <TabsList>
        <TabsTrigger value="config">Configuration</TabsTrigger>
        <TabsTrigger value="test">Test</TabsTrigger>
      </TabsList>

      <TabsContent value="config">
        <div className="flex flex-col gap-4">
          <Field label="Method">
            <Select value={method} onValueChange={(v) => v && set({ method: v })}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="URL">
            <VariableInput value={(input.url as string) ?? ''} onChange={(v) => set({ url: v })} sources={sources} placeholder="https://api.example.com/hook" />
          </Field>
          <Field label="Headers">
            <KeyValueEditor value={(input.headers as Record<string, string>) ?? {}} onChange={(v) => set({ headers: v })} />
          </Field>
          {hasBody && (
            <>
              <Field label="Body type">
                <Select value={bodyType} onValueChange={(v) => v && set({ bodyType: v })}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="rawJson">Raw JSON</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              {bodyType === 'rawJson' && (
                <Field label="Body (JSON)">
                  <VariableInput value={(input.body as string) ?? ''} onChange={(v) => set({ body: v })} sources={sources} multiline />
                </Field>
              )}
            </>
          )}
          <Field label="Expected response body" hint="Paste a sample response to reference its keys downstream.">
            <Textarea
              value={(input.expectedOutputBody as string) ?? ''}
              placeholder={'{\n  "id": "..."\n}'}
              onChange={(e) => set({ expectedOutputBody: e.target.value })}
              className="min-h-20 font-mono text-xs"
            />
          </Field>
        </div>
      </TabsContent>

      <TabsContent value="test">
        <div className="flex flex-col gap-3">
          <p className="text-[11px] text-muted-foreground">Runs the request with the literal values above (variables are not resolved in a test).</p>
          <Button size="sm" onClick={() => test.mutate()} disabled={test.isPending || !input.url}>
            <Play className="size-4" /> Run test
          </Button>
          {test.data && <TestResult value={test.data} />}
        </div>
      </TabsContent>
    </Tabs>
  );
}

function TestResult({ value }: { value: unknown }) {
  return (
    <pre className="max-h-64 overflow-auto rounded-md bg-muted p-3 text-xs">{JSON.stringify(value, null, 2)}</pre>
  );
}

interface FormFieldDef {
  id: string;
  name: string;
  label: string;
  type: string;
}

function FormActionForm({ step, onChange }: { step: WorkflowStep; onChange: (s: WorkflowStep) => void }) {
  const input = getInput(step);
  const title = (input.title as string) ?? '';
  const fields = ((input.fields as FormFieldDef[]) ?? []).slice();

  const commit = (nextFields: FormFieldDef[], nextTitle = title) =>
    onChange({ ...setInput(step, { title: nextTitle, fields: nextFields }), valid: nextFields.length > 0 });

  return (
    <div className="flex flex-col gap-4">
      <Field label="Title">
        <Input value={title} onChange={(e) => commit(fields, e.target.value)} />
      </Field>
      <div className="flex flex-col gap-2">
        <div className="text-xs font-medium text-muted-foreground">Fields</div>
        {fields.map((f) => (
          <div key={f.id} className="flex items-center gap-2">
            <Input
              className="flex-1"
              placeholder="Label"
              value={f.label}
              onChange={(e) => commit(fields.map((x) => (x.id === f.id ? { ...x, label: e.target.value, name: slug(e.target.value) } : x)))}
            />
            <Select value={f.type} onValueChange={(v) => v && commit(fields.map((x) => (x.id === f.id ? { ...x, type: v } : x)))}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TEXT">Text</SelectItem>
                <SelectItem value="NUMBER">Number</SelectItem>
                <SelectItem value="BOOLEAN">Checkbox</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="ghost" size="icon-xs" onClick={() => commit(fields.filter((x) => x.id !== f.id))} aria-label="Remove field">
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        ))}
      </div>
      <Button variant="outline" size="sm" onClick={() => commit([...fields, { id: newId(), name: 'field', label: 'Field', type: 'TEXT' }])}>
        <Plus className="size-4" /> Add field
      </Button>
    </div>
  );
}

function slug(label: string): string {
  return label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'field';
}

function CodeForm({ step, onChange, sources }: { step: WorkflowStep; onChange: (s: WorkflowStep) => void; sources: ConditionStepSource[] }) {
  const input = getInput(step);
  const code = (input.code as string) ?? '';
  const params = inferCodeParams(code);
  const paramValues = (input.params as Record<string, unknown>) ?? {};
  const [testValues, setTestValues] = useState<Record<string, unknown>>({});

  const isComplex = (type: string) => type !== 'string' && type !== 'number' && type !== 'boolean';
  const setParam = (name: string, v: string) => onChange(setInput(step, { params: { ...paramValues, [name]: v } }));
  const paramValueAsString = (name: string): string => {
    const v = paramValues[name];
    return typeof v === 'string' ? v : v == null ? '' : JSON.stringify(v);
  };

  const test = useMutation({
    mutationFn: () => workflowApi.testCode(code, testValues),
  });

  return (
    <Tabs defaultValue="code">
      <TabsList>
        <TabsTrigger value="code">Code</TabsTrigger>
        <TabsTrigger value="test">Test</TabsTrigger>
      </TabsList>

      <TabsContent value="code">
        <div className="flex flex-col gap-4">
          {params.length > 0 && (
            <div className="flex flex-col gap-3">
              <div className="text-xs font-medium text-muted-foreground">Inputs</div>
              {params.map((p) => (
                <Field
                  key={p.name}
                  label={`${p.name} (${p.type})`}
                  hint={isComplex(p.type) ? 'A JSON/array literal, or click {} to insert a variable.' : undefined}
                >
                  <VariableInput
                    value={paramValueAsString(p.name)}
                    onChange={(v) => setParam(p.name, v)}
                    sources={sources}
                    multiline={isComplex(p.type)}
                  />
                </Field>
              ))}
            </div>
          )}
          <Field label="JavaScript" hint="Sandboxed. `context` holds prior-step outputs + your inputs; `return` a JSON value.">
            <Textarea
              value={code}
              onChange={(e) => onChange({ ...setInput(step, { code: e.target.value }), valid: !!e.target.value })}
              className="min-h-56 font-mono text-xs"
              spellCheck={false}
            />
          </Field>
          <Field label="Expected output body" hint="Paste a sample output to reference its keys downstream.">
            <Textarea
              value={(input.expectedOutputBody as string) ?? ''}
              placeholder={'{\n  "message": "..."\n}'}
              onChange={(e) => onChange(setInput(step, { expectedOutputBody: e.target.value }))}
              className="min-h-20 font-mono text-xs"
            />
          </Field>
        </div>
      </TabsContent>

      <TabsContent value="test">
        <div className="flex flex-col gap-3">
          <p className="text-[11px] text-muted-foreground">Test values are literal — variables aren't resolved outside a real run.</p>
          {params.map((p) => (
            <Field key={p.name} label={`${p.name} (${p.type})`}>
              {isComplex(p.type) ? (
                <Textarea
                  value={typeof testValues[p.name] === 'string' ? (testValues[p.name] as string) : ''}
                  onChange={(e) => setTestValues((prev) => ({ ...prev, [p.name]: e.target.value }))}
                  className="min-h-20 font-mono text-xs"
                  placeholder='{ "id": "..." } or [1, 2, 3]'
                />
              ) : (
                <Input
                  value={String(testValues[p.name] ?? '')}
                  onChange={(e) =>
                    setTestValues((prev) => ({
                      ...prev,
                      [p.name]: p.type === 'number' ? Number(e.target.value) : e.target.value,
                    }))
                  }
                />
              )}
            </Field>
          ))}
          <Button size="sm" onClick={() => test.mutate()} disabled={test.isPending || !code}>
            <Play className="size-4" /> Run test
          </Button>
          {test.data && <TestResult value={test.data} />}
        </div>
      </TabsContent>
    </Tabs>
  );
}
