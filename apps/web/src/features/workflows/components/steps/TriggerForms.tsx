import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CronExpressionParser } from 'cron-parser';
import { Check, Copy } from 'lucide-react';
import {
  WorkflowTriggerType,
  buildCronPattern,
  type StepFilter,
  type StepFilterGroup,
  type WorkflowTrigger,
} from '@saasly/shared';
import { dataModelApi, workspaceApi } from '@/lib/api-client';
import { getApiBaseUrl } from '@/lib/host';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { IconPicker } from '@/components/IconPicker';
import { ROLE_ICON_OPTIONS } from '@/lib/icons';
import { Field } from './fields';
import { ConditionBuilder } from './ConditionBuilder';
import { useObjectFields, type ConditionStepSource } from '../../lib/step-sources';

interface Props {
  trigger: WorkflowTrigger;
  workflowId: string;
  onChange: (trigger: WorkflowTrigger) => void;
}

interface FormProps {
  trigger: WorkflowTrigger;
  onChange: (trigger: WorkflowTrigger) => void;
}

function setSetting(trigger: WorkflowTrigger, key: string, value: unknown): WorkflowTrigger {
  return { ...trigger, settings: { ...trigger.settings, [key]: value } };
}

/** The trigger's own record, exposed under `record.<field>` — used for its condition filter (root, no prior steps). */
function triggerRecordSource(objectFields: ReturnType<typeof useObjectFields>): ConditionStepSource[] {
  return [{ id: 'trigger', label: 'Record', fields: objectFields.map((f) => ({ ...f, key: `record.${f.key}` })) }];
}

export function TriggerForm({ trigger, workflowId, onChange }: Props) {
  switch (trigger.type) {
    case WorkflowTriggerType.DATABASE_EVENT:
      return <DatabaseEventForm trigger={trigger} onChange={onChange} />;
    case WorkflowTriggerType.CRON:
      return <CronForm trigger={trigger} onChange={onChange} />;
    case WorkflowTriggerType.WEBHOOK:
      return <WebhookForm trigger={trigger} workflowId={workflowId} onChange={onChange} />;
    case WorkflowTriggerType.MANUAL:
    default:
      return <ManualForm trigger={trigger} onChange={onChange} />;
  }
}

function DatabaseEventForm({ trigger, onChange }: FormProps) {
  const { data: objects } = useQuery({ queryKey: ['data-model-objects'], queryFn: dataModelApi.listObjects });
  const objectName = (trigger.settings.objectName as string) ?? '';
  const event = (trigger.settings.event as string) ?? 'created';
  const objectFields = useObjectFields(objectName);
  const watchesFields = event === 'updated' || event === 'created-or-updated';
  const watchedFields = (trigger.settings.fields as string[] | null) ?? [];
  const filter = (trigger.settings.filter as { stepFilters?: StepFilter[]; stepFilterGroups?: StepFilterGroup[] } | null) ?? null;

  return (
    <div className="flex flex-col gap-4">
      <Field label="Record type">
        <Select value={objectName || undefined} onValueChange={(v) => v && onChange(setSetting(trigger, 'objectName', v))}>
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
      </Field>
      <Field label="Event">
        <Select value={event} onValueChange={(v) => v && onChange(setSetting(trigger, 'event', v))}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="created">Record is created</SelectItem>
            <SelectItem value="updated">Record is updated</SelectItem>
            <SelectItem value="deleted">Record is deleted</SelectItem>
            <SelectItem value="created-or-updated">Record is created or updated</SelectItem>
          </SelectContent>
        </Select>
      </Field>

      {watchesFields && objectName && (
        <Field label="Watched fields (optional)" hint="Only fire when one of these fields changes. Leave empty for any change.">
          <div className="flex flex-wrap gap-1.5">
            {objectFields.map((f) => {
              const active = watchedFields.includes(f.key);
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() =>
                    onChange(
                      setSetting(
                        trigger,
                        'fields',
                        active ? watchedFields.filter((k) => k !== f.key) : [...watchedFields, f.key],
                      ),
                    )
                  }
                  className={`rounded-full border px-2 py-0.5 text-xs ${active ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent'}`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        </Field>
      )}

      {objectName && (
        <Field label="Conditions (optional)" hint="Only run when the record matches.">
          <ConditionBuilder
            value={{ stepFilters: filter?.stepFilters ?? [], stepFilterGroups: filter?.stepFilterGroups ?? [] }}
            steps={triggerRecordSource(objectFields)}
            sources={triggerRecordSource(objectFields)}
            onChange={(v) => onChange(setSetting(trigger, 'filter', v))}
          />
        </Field>
      )}
    </div>
  );
}

function ManualForm({ trigger, onChange }: FormProps) {
  const { data: objects } = useQuery({ queryKey: ['data-model-objects'], queryFn: dataModelApi.listObjects });
  const availability = ((trigger.settings.availability as { type?: string } | null)?.type) ?? 'GLOBAL';
  const objectNameSingular = (trigger.settings.availability as { objectNameSingular?: string } | null)?.objectNameSingular ?? '';
  const icon = (trigger.settings.icon as string) ?? 'Play';
  const isPinned = trigger.settings.isPinned === true;
  const needsObject = availability === 'SINGLE_RECORD' || availability === 'BULK_RECORDS';

  const setAvailability = (type: string) =>
    onChange(setSetting(trigger, 'availability', type === 'GLOBAL' ? { type } : { type, objectNameSingular }));

  return (
    <div className="flex flex-col gap-4">
      <Field
        label="Availability"
        hint={
          availability === 'SINGLE_RECORD'
            ? 'The selected record is passed to the workflow.'
            : availability === 'BULK_RECORDS'
              ? 'The selected records (up to 200) are passed to the workflow.'
              : 'No record is required to trigger this workflow.'
        }
      >
        <Select value={availability} onValueChange={(v) => v && setAvailability(v)}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="GLOBAL">Global</SelectItem>
            <SelectItem value="SINGLE_RECORD">Single record</SelectItem>
            <SelectItem value="BULK_RECORDS">Bulk records (up to 200)</SelectItem>
          </SelectContent>
        </Select>
      </Field>

      {needsObject && (
        <Field label="Object">
          <Select
            value={objectNameSingular || undefined}
            onValueChange={(v) => v && onChange(setSetting(trigger, 'availability', { type: availability, objectNameSingular: v }))}
          >
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
        </Field>
      )}

      <Field label="Command icon" hint="Shown in the command menu.">
        <IconPicker value={icon} options={ROLE_ICON_OPTIONS} onChange={(v) => onChange(setSetting(trigger, 'icon', v))} />
      </Field>

      <Field label="Navbar" hint="Show a button in the top navbar to trigger this workflow.">
        <Select value={isPinned ? 'true' : 'false'} onValueChange={(v) => onChange(setSetting(trigger, 'isPinned', v === 'true'))}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="false">Not pinned</SelectItem>
            <SelectItem value="true">Pinned</SelectItem>
          </SelectContent>
        </Select>
      </Field>
    </div>
  );
}

function CronForm({ trigger, onChange }: FormProps) {
  const interval = (trigger.settings.interval as string) ?? 'DAYS';
  const s = trigger.settings as Record<string, unknown>;
  const pattern = buildCronPattern(s);

  const upcoming = useMemo(() => {
    if (!pattern) return [];
    try {
      const it = CronExpressionParser.parse(pattern, { tz: 'UTC' });
      return [it.next(), it.next(), it.next()].map((d) => d.toDate().toUTCString());
    } catch {
      return null; // invalid
    }
  }, [pattern]);

  return (
    <div className="flex flex-col gap-4">
      <Field label="Trigger interval" hint="Cron is triggered at UTC time.">
        <Select value={interval} onValueChange={(v) => v && onChange(setSetting(trigger, 'interval', v))}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="MINUTES">Minutes</SelectItem>
            <SelectItem value="HOURS">Hours</SelectItem>
            <SelectItem value="DAYS">Days</SelectItem>
            <SelectItem value="CUSTOM">Cron (custom)</SelectItem>
          </SelectContent>
        </Select>
      </Field>

      {interval === 'MINUTES' && (
        <Field label="Minutes between triggers">
          <Input type="number" min={1} value={String(s.everyMinutes ?? 15)} onChange={(e) => onChange(setSetting(trigger, 'everyMinutes', Number(e.target.value) || 1))} />
        </Field>
      )}
      {interval === 'HOURS' && (
        <div className="grid grid-cols-2 gap-2">
          <Field label="Hours between triggers">
            <Input type="number" min={1} value={String(s.everyHours ?? 1)} onChange={(e) => onChange(setSetting(trigger, 'everyHours', Number(e.target.value) || 1))} />
          </Field>
          <Field label="At minute (UTC)">
            <Input type="number" min={0} max={59} value={String(s.minute ?? 0)} onChange={(e) => onChange(setSetting(trigger, 'minute', Number(e.target.value) || 0))} />
          </Field>
        </div>
      )}
      {interval === 'DAYS' && (
        <div className="grid grid-cols-3 gap-2">
          <Field label="Every N days">
            <Input type="number" min={1} value={String(s.day ?? 1)} onChange={(e) => onChange(setSetting(trigger, 'day', Number(e.target.value) || 1))} />
          </Field>
          <Field label="At hour (UTC)">
            <Input type="number" min={0} max={23} value={String(s.hour ?? 9)} onChange={(e) => onChange(setSetting(trigger, 'hour', Number(e.target.value) || 0))} />
          </Field>
          <Field label="At minute (UTC)">
            <Input type="number" min={0} max={59} value={String(s.minute ?? 0)} onChange={(e) => onChange(setSetting(trigger, 'minute', Number(e.target.value) || 0))} />
          </Field>
        </div>
      )}
      {interval === 'CUSTOM' && (
        <Field label="Cron expression" hint="Standard 5-field cron, e.g. `0 9 * * *`.">
          <Input value={(s.pattern as string) ?? ''} placeholder="0 9 * * *" onChange={(e) => onChange(setSetting(trigger, 'pattern', e.target.value))} />
        </Field>
      )}

      <div className="rounded-md border bg-muted/30 p-3 text-xs">
        <div className="mb-1 font-medium text-muted-foreground">Upcoming executions (UTC)</div>
        {upcoming === null ? (
          <span className="text-destructive">Invalid cron expression</span>
        ) : upcoming.length === 0 ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {upcoming.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function WebhookForm({ trigger, workflowId, onChange }: Props) {
  const httpMethod = (trigger.settings.httpMethod as string) ?? 'POST';
  const [copied, setCopied] = useState(false);
  const { data: workspace } = useQuery({ queryKey: ['current-workspace'], queryFn: workspaceApi.getCurrent });
  const liveUrl = workspace ? `${getApiBaseUrl()}/triggers/webhook/${workspace.id}/${workflowId}` : '';

  return (
    <div className="flex flex-col gap-4">
      <Field label="Live URL" hint="Call this URL to start the workflow. Active only once the workflow is activated.">
        <div className="flex items-center gap-1">
          <Input readOnly value={liveUrl} className="flex-1 font-mono text-xs" />
          <Button
            type="button"
            variant="outline"
            size="icon-xs"
            aria-label="Copy URL"
            onClick={() => {
              void navigator.clipboard?.writeText(liveUrl);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          </Button>
        </div>
      </Field>
      <Field label="HTTP method">
        <Select value={httpMethod} onValueChange={(v) => v && onChange(setSetting(trigger, 'httpMethod', v))}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="POST">POST</SelectItem>
            <SelectItem value="GET">GET</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      {httpMethod === 'POST' && (
        <Field label="Expected body (sample JSON)" hint="Paste a sample payload to reference its keys downstream, e.g. {{trigger.name}}.">
          <Textarea
            value={(trigger.settings.expectedBody as string) ?? ''}
            placeholder={'{\n  "name": "Acme"\n}'}
            onChange={(e) => onChange(setSetting(trigger, 'expectedBody', e.target.value))}
            className="min-h-24 font-mono text-xs"
          />
        </Field>
      )}
    </div>
  );
}
