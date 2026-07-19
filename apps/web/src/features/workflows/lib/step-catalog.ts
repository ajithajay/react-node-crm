import {
  WorkflowActionType,
  WorkflowTriggerType,
  type WorkflowStep,
  type WorkflowTrigger,
} from '@saasly/shared';

// Catalog metadata for triggers and actions — label, lucide icon name, menu group, and the default
// settings a freshly-added node starts with.

export interface TriggerCatalogEntry {
  type: WorkflowTriggerType;
  label: string;
  description: string;
  icon: string;
}

export const TRIGGER_CATALOG: TriggerCatalogEntry[] = [
  {
    type: WorkflowTriggerType.DATABASE_EVENT,
    label: 'Record event',
    description: 'When a record is created, updated or deleted',
    icon: 'Database',
  },
  {
    type: WorkflowTriggerType.MANUAL,
    label: 'Manual trigger',
    description: 'Launched manually or from a record',
    icon: 'MousePointerClick',
  },
  { type: WorkflowTriggerType.CRON, label: 'On a schedule', description: 'Run on a recurring schedule', icon: 'Clock' },
  { type: WorkflowTriggerType.WEBHOOK, label: 'Webhook', description: 'When a webhook URL is called', icon: 'Webhook' },
];

export type ActionGroup = 'Data' | 'Flow' | 'Core';

export interface ActionCatalogEntry {
  type: WorkflowActionType;
  label: string;
  description: string;
  icon: string;
  group: ActionGroup;
}

export const ACTION_CATALOG: ActionCatalogEntry[] = [
  // Data
  { type: WorkflowActionType.CREATE_RECORD, label: 'Create record', description: 'Create a new record', icon: 'Plus', group: 'Data' },
  { type: WorkflowActionType.UPDATE_RECORD, label: 'Update record', description: 'Update an existing record', icon: 'Pencil', group: 'Data' },
  { type: WorkflowActionType.DELETE_RECORD, label: 'Delete record', description: 'Delete a record', icon: 'Trash2', group: 'Data' },
  { type: WorkflowActionType.UPSERT_RECORD, label: 'Create or update record', description: 'Update if it exists, else create', icon: 'FilePlus2', group: 'Data' },
  { type: WorkflowActionType.FIND_RECORDS, label: 'Search records', description: 'Find records matching a filter', icon: 'Search', group: 'Data' },
  // Flow
  { type: WorkflowActionType.FILTER, label: 'Filter', description: 'Continue only if a condition holds', icon: 'Filter', group: 'Flow' },
  { type: WorkflowActionType.IF_ELSE, label: 'If / Else', description: 'Branch on a condition', icon: 'GitBranch', group: 'Flow' },
  { type: WorkflowActionType.ITERATOR, label: 'Iterator', description: 'Loop over a list of items', icon: 'Repeat', group: 'Flow' },
  { type: WorkflowActionType.DELAY, label: 'Delay', description: 'Wait before continuing', icon: 'Timer', group: 'Flow' },
  // Core
  { type: WorkflowActionType.SEND_EMAIL, label: 'Send email', description: 'Send an email', icon: 'Mail', group: 'Core' },
  { type: WorkflowActionType.HTTP_REQUEST, label: 'HTTP request', description: 'Call an external API', icon: 'Globe', group: 'Core' },
  { type: WorkflowActionType.FORM, label: 'Form', description: 'Pause for human input', icon: 'ClipboardList', group: 'Core' },
  { type: WorkflowActionType.CODE, label: 'Code', description: 'Run a JavaScript snippet', icon: 'Code', group: 'Core' },
];

export const ACTION_GROUPS: ActionGroup[] = ['Data', 'Flow', 'Core'];

export function actionEntry(type: string): ActionCatalogEntry | undefined {
  return ACTION_CATALOG.find((a) => a.type === type);
}
export function triggerEntry(type: string): TriggerCatalogEntry | undefined {
  return TRIGGER_CATALOG.find((t) => t.type === type);
}

const emptyErrorHandling = {
  retryOnFailure: { value: false },
  continueOnFailure: { value: false },
};

/** Default trigger object for a freshly-picked trigger type. */
export function defaultTrigger(type: WorkflowTriggerType): WorkflowTrigger {
  const base = { type, name: triggerEntry(type)?.label ?? 'Trigger', nextStepIds: [] as string[] };
  switch (type) {
    case WorkflowTriggerType.DATABASE_EVENT:
      return { ...base, settings: { objectName: '', event: 'created' } };
    case WorkflowTriggerType.CRON:
      return { ...base, settings: { interval: 'DAYS', day: 1, hour: 9, minute: 0 } };
    case WorkflowTriggerType.WEBHOOK:
      return { ...base, settings: { httpMethod: 'POST' } };
    case WorkflowTriggerType.MANUAL:
    default:
      return { ...base, settings: {} };
  }
}

/** Default step object for a freshly-added action of `type`, with a caller-supplied id. */
export function defaultStep(type: WorkflowActionType, id: string): WorkflowStep {
  const entry = actionEntry(type);
  const base = {
    id,
    name: entry?.label ?? 'Action',
    type,
    valid: false,
    nextStepIds: [] as string[],
  };
  const withInput = (input: unknown) => ({
    ...base,
    settings: { input, errorHandlingOptions: emptyErrorHandling },
  });

  switch (type) {
    case WorkflowActionType.CREATE_RECORD:
    case WorkflowActionType.UPDATE_RECORD:
    case WorkflowActionType.UPSERT_RECORD:
      return withInput({ objectName: '', objectRecord: {} });
    case WorkflowActionType.DELETE_RECORD:
      return withInput({ objectName: '', objectRecordId: '' });
    case WorkflowActionType.FIND_RECORDS:
      return withInput({ objectName: '', filter: {}, limit: 20 });
    case WorkflowActionType.FILTER:
      return withInput({ stepFilters: [], stepFilterGroups: [] });
    case WorkflowActionType.IF_ELSE:
      return { ...base, settings: { input: { stepFilters: [], stepFilterGroups: [], branches: [] }, errorHandlingOptions: emptyErrorHandling } };
    case WorkflowActionType.ITERATOR:
      return { ...base, settings: { input: { items: '', initialLoopStepIds: [] }, errorHandlingOptions: emptyErrorHandling } };
    case WorkflowActionType.DELAY:
      return withInput({ duration: 1, unit: 'MINUTES' });
    case WorkflowActionType.SEND_EMAIL:
      return withInput({ to: '', subject: '', body: '' });
    case WorkflowActionType.HTTP_REQUEST:
      return withInput({ url: '', method: 'POST', headers: {}, body: '' });
    case WorkflowActionType.FORM:
      return withInput({ title: 'Please provide input', fields: [] });
    case WorkflowActionType.CODE:
      return withInput({
        params: {},
        code: [
          'export const main = async (params: {',
          '  a: string;',
          '  b: number;',
          '}): Promise<object> => {',
          '  const { a, b } = params;',
          '',
          '  const message = `Hello, input: ${a} and ${b}`;',
          '',
          '  return { message };',
          '};',
        ].join('\n'),
      });
    default:
      return withInput({});
  }
}
