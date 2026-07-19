import { z } from 'zod';

/**
 * Workflow contracts (Phase 8). A simplified workflow module for our REST
 * stack: a Workflow is a thin container of WorkflowVersions; each version holds a single `trigger`
 * plus a flat array of `steps` forming a DAG (the trigger is the root; every node carries
 * `nextStepIds`). A WorkflowRun snapshots a version's flow and tracks per-step execution state.
 *
 * The step id of the trigger, used as the root context key (`{{trigger.*}}`).
 */
export const TRIGGER_STEP_ID = 'trigger' as const;

// ── Statuses ────────────────────────────────────────────────────────────────
export const WorkflowStatus = {
  DRAFT: 'DRAFT',
  ACTIVE: 'ACTIVE',
  DEACTIVATED: 'DEACTIVATED',
} as const;
export type WorkflowStatus = (typeof WorkflowStatus)[keyof typeof WorkflowStatus];

export const WorkflowVersionStatus = {
  DRAFT: 'DRAFT',
  ACTIVE: 'ACTIVE',
  DEACTIVATED: 'DEACTIVATED',
  ARCHIVED: 'ARCHIVED',
} as const;
export type WorkflowVersionStatus =
  (typeof WorkflowVersionStatus)[keyof typeof WorkflowVersionStatus];

export const WorkflowRunStatus = {
  NOT_STARTED: 'NOT_STARTED',
  ENQUEUED: 'ENQUEUED',
  RUNNING: 'RUNNING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  STOPPED: 'STOPPED',
} as const;
export type WorkflowRunStatus = (typeof WorkflowRunStatus)[keyof typeof WorkflowRunStatus];

/** Per-step execution status inside a run's state. */
export const StepStatus = {
  NOT_STARTED: 'NOT_STARTED',
  RUNNING: 'RUNNING',
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
  FAILED_SAFELY: 'FAILED_SAFELY',
  SKIPPED: 'SKIPPED',
  PENDING: 'PENDING',
  STOPPED: 'STOPPED',
} as const;
export type StepStatus = (typeof StepStatus)[keyof typeof StepStatus];

// ── Trigger & action type enums ───────────────────────────────────────────────
export const WorkflowTriggerType = {
  DATABASE_EVENT: 'DATABASE_EVENT',
  MANUAL: 'MANUAL',
  CRON: 'CRON',
  WEBHOOK: 'WEBHOOK',
} as const;
export type WorkflowTriggerType =
  (typeof WorkflowTriggerType)[keyof typeof WorkflowTriggerType];

export const WorkflowActionType = {
  // Data
  CREATE_RECORD: 'CREATE_RECORD',
  UPDATE_RECORD: 'UPDATE_RECORD',
  DELETE_RECORD: 'DELETE_RECORD',
  UPSERT_RECORD: 'UPSERT_RECORD',
  FIND_RECORDS: 'FIND_RECORDS',
  // Flow
  FILTER: 'FILTER',
  IF_ELSE: 'IF_ELSE',
  ITERATOR: 'ITERATOR',
  DELAY: 'DELAY',
  // Core
  SEND_EMAIL: 'SEND_EMAIL',
  HTTP_REQUEST: 'HTTP_REQUEST',
  FORM: 'FORM',
  CODE: 'CODE',
} as const;
export type WorkflowActionType =
  (typeof WorkflowActionType)[keyof typeof WorkflowActionType];

// ── Record-event trigger events ──────────────────────────────────────────────
export const RecordEventAction = {
  CREATED: 'created',
  UPDATED: 'updated',
  DELETED: 'deleted',
  CREATED_OR_UPDATED: 'created-or-updated',
} as const;
export type RecordEventAction = (typeof RecordEventAction)[keyof typeof RecordEventAction];

// ── Step filters (for FILTER / IF_ELSE) ──
export const stepFilterOperandSchema = z.enum([
  'eq',
  'ne',
  'gt',
  'gte',
  'lt',
  'lte',
  'contains',
  'doesNotContain',
  'isEmpty',
  'isNotEmpty',
  'isTrue',
  'isFalse',
]);
export type StepFilterOperand = z.infer<typeof stepFilterOperandSchema>;

export const stepFilterSchema = z.object({
  id: z.string(),
  // The picked field's type (drives the operand list in the builder), e.g. 'TEXT'/'NUMBER'.
  type: z.string().optional(),
  // A `{{...}}` variable template or a literal — resolved against context at run time.
  leftValue: z.unknown().optional(),
  // Kept as a plain string (the builder emits operands per field type); values are the operand ids above.
  operand: z.string(),
  rightValue: z.unknown().optional(),
  // Group this filter belongs to (AND/OR per group; groups can nest one level).
  stepFilterGroupId: z.string().optional(),
  displayValue: z.string().optional(),
});
export type StepFilter = z.infer<typeof stepFilterSchema>;

export const stepFilterGroupSchema = z.object({
  id: z.string(),
  logicalOperator: z.enum(['AND', 'OR']).default('AND'),
  parentStepFilterGroupId: z.string().optional(),
  positionInParent: z.number().optional(),
});
export type StepFilterGroup = z.infer<typeof stepFilterGroupSchema>;

// ── Trigger definition (the DAG root) ─────────────────────────────────────────
const positionSchema = z.object({ x: z.number(), y: z.number() }).optional();

export const workflowTriggerSchema = z.object({
  type: z.enum([
    WorkflowTriggerType.DATABASE_EVENT,
    WorkflowTriggerType.MANUAL,
    WorkflowTriggerType.CRON,
    WorkflowTriggerType.WEBHOOK,
  ]),
  name: z.string(),
  // Per-type settings — kept permissive (passthrough) so the builder can evolve settings without a
  // schema-version bump; the executor reads only the keys it needs.
  settings: z.record(z.string(), z.unknown()).default({}),
  nextStepIds: z.array(z.string()).default([]),
  position: positionSchema,
});
export type WorkflowTrigger = z.infer<typeof workflowTriggerSchema>;

// ── Step definition (a DAG node) ──────────────────────────────────────────────
export const errorHandlingOptionsSchema = z
  .object({
    retryOnFailure: z.object({ value: z.boolean() }).default({ value: false }),
    continueOnFailure: z.object({ value: z.boolean() }).default({ value: false }),
  })
  .default({ retryOnFailure: { value: false }, continueOnFailure: { value: false } });
export type ErrorHandlingOptions = z.infer<typeof errorHandlingOptionsSchema>;

export const workflowStepSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum([
    WorkflowActionType.CREATE_RECORD,
    WorkflowActionType.UPDATE_RECORD,
    WorkflowActionType.DELETE_RECORD,
    WorkflowActionType.UPSERT_RECORD,
    WorkflowActionType.FIND_RECORDS,
    WorkflowActionType.FILTER,
    WorkflowActionType.IF_ELSE,
    WorkflowActionType.ITERATOR,
    WorkflowActionType.DELAY,
    WorkflowActionType.SEND_EMAIL,
    WorkflowActionType.HTTP_REQUEST,
    WorkflowActionType.FORM,
    WorkflowActionType.CODE,
  ]),
  valid: z.boolean().default(false),
  settings: z
    .object({
      input: z.unknown().optional(),
      errorHandlingOptions: errorHandlingOptionsSchema.optional(),
    })
    .passthrough()
    .default({}),
  nextStepIds: z.array(z.string()).default([]),
  position: positionSchema,
});
export type WorkflowStep = z.infer<typeof workflowStepSchema>;

/** The full flow definition stored on a version (and snapshotted onto a run). */
export const workflowFlowSchema = z.object({
  trigger: workflowTriggerSchema.nullable(),
  steps: z.array(workflowStepSchema).default([]),
});
export type WorkflowFlow = z.infer<typeof workflowFlowSchema>;

// ── Run state ────────────────────────────────────────────────────────────────
export interface WorkflowRunStepInfo {
  status: StepStatus;
  /** The step's own settings.input, AFTER `{{...}}` variables were resolved against the run context. */
  input?: unknown;
  result?: unknown;
  error?: string;
  startedAt?: string;
  endedAt?: string;
}
export type WorkflowRunStepInfos = Record<string, WorkflowRunStepInfo>;

export interface WorkflowRunState {
  flow: WorkflowFlow;
  stepInfos: WorkflowRunStepInfos;
  workflowRunError?: string;
}

// ── Request / response DTOs ───────────────────────────────────────────────────
export const createWorkflowRequestSchema = z.object({
  name: z.string().trim().min(1).max(200),
});
export type CreateWorkflowRequest = z.infer<typeof createWorkflowRequestSchema>;

export const updateWorkflowRequestSchema = z.object({
  name: z.string().trim().min(1).max(200),
});
export type UpdateWorkflowRequest = z.infer<typeof updateWorkflowRequestSchema>;

/** Patch a DRAFT version's flow (trigger + steps). Sent by the builder on every edit. */
export const updateWorkflowVersionRequestSchema = z.object({
  trigger: workflowTriggerSchema.nullable().optional(),
  steps: z.array(workflowStepSchema).optional(),
});
export type UpdateWorkflowVersionRequest = z.infer<
  typeof updateWorkflowVersionRequestSchema
>;

/** Manual-trigger run request; `payload` becomes the trigger's context. */
export const runWorkflowRequestSchema = z.object({
  payload: z.record(z.string(), z.unknown()).optional(),
});
export type RunWorkflowRequest = z.infer<typeof runWorkflowRequestSchema>;

export const workflowRunQuerySchema = z.object({
  workflowId: z.string().uuid().optional(),
  status: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type WorkflowRunQuery = z.infer<typeof workflowRunQuerySchema>;

// ── Manual trigger "availability" (where a MANUAL-trigger workflow can be run from) ───────────────
export const ManualTriggerAvailability = {
  GLOBAL: 'GLOBAL',
  SINGLE_RECORD: 'SINGLE_RECORD',
  BULK_RECORDS: 'BULK_RECORDS',
} as const;
export type ManualTriggerAvailability =
  (typeof ManualTriggerAvailability)[keyof typeof ManualTriggerAvailability];

/** Parse a MANUAL trigger's `settings.availability` (an informal bag written by the builder's UI). */
export function parseManualAvailability(
  settings: Record<string, unknown> | undefined,
): { type: ManualTriggerAvailability; objectNameSingular?: string } {
  const raw = (settings?.availability ?? null) as { type?: string; objectNameSingular?: string } | null;
  const type =
    raw?.type === ManualTriggerAvailability.SINGLE_RECORD || raw?.type === ManualTriggerAvailability.BULK_RECORDS
      ? raw.type
      : ManualTriggerAvailability.GLOBAL;
  return type === ManualTriggerAvailability.GLOBAL ? { type } : { type, objectNameSingular: raw?.objectNameSingular };
}

export const workflowRunnableQuerySchema = z.object({
  availability: z.enum([
    ManualTriggerAvailability.GLOBAL,
    ManualTriggerAvailability.SINGLE_RECORD,
    ManualTriggerAvailability.BULK_RECORDS,
  ]),
  objectName: z.string().optional(),
});
export type WorkflowRunnableQuery = z.infer<typeof workflowRunnableQuerySchema>;

/** A MANUAL-trigger workflow runnable from a given surface (global menu, record page, bulk bar).
 * `isPinned` drives the UI split: pinned workflows render as an always-visible one-click button,
 * unpinned ones live inside a "Run workflow" dropdown. */
export interface WorkflowRunnableSummary {
  id: string;
  name: string;
  icon: string | null;
  isPinned: boolean;
}

// Response shapes (not request-validated — plain interfaces, per shared conventions).
export interface WorkflowVersionSummary {
  id: string;
  workflowId: string;
  name: string;
  status: WorkflowVersionStatus;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowVersionDetail extends WorkflowVersionSummary {
  trigger: WorkflowTrigger | null;
  steps: WorkflowStep[];
}

export interface WorkflowSummary {
  id: string;
  name: string;
  statuses: WorkflowStatus[];
  lastPublishedVersionId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowDetail extends WorkflowSummary {
  currentVersion: WorkflowVersionDetail | null;
  versions: WorkflowVersionSummary[];
}

export interface WorkflowRunSummary {
  id: string;
  workflowId: string;
  workflowName: string;
  workflowVersionId: string;
  status: WorkflowRunStatus;
  enqueuedAt: string | null;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
}

export interface WorkflowRunDetail extends WorkflowRunSummary {
  state: WorkflowRunState;
}

/** Build a 5-field cron string from a CRON trigger's settings (shared by the builder preview + api registration). */
export function buildCronPattern(settings: Record<string, unknown>): string {
  const interval = (settings.interval as string) ?? 'DAYS';
  if (interval === 'CUSTOM') return String(settings.pattern ?? '').trim();
  const minute = Number(settings.minute ?? 0);
  const hour = Number(settings.hour ?? 9);
  const day = Math.max(1, Number(settings.day ?? 1));
  if (interval === 'MINUTES') return `*/${Math.max(1, Number(settings.everyMinutes ?? 15))} * * * *`;
  if (interval === 'HOURS') return `${minute} */${Math.max(1, Number(settings.everyHours ?? 1))} * * *`;
  return `${minute} ${hour} */${day} * *`; // DAYS
}

/**
 * Build the initial run state: snapshot the flow and seed per-step status (trigger result = payload,
 * every step NOT_STARTED). Pure — shared by the api (manual/record-event/webhook) and the worker (cron).
 */
export function buildInitialRunState(
  trigger: WorkflowTrigger | null,
  steps: WorkflowStep[],
  payload: Record<string, unknown>,
): WorkflowRunState {
  const stepInfos: WorkflowRunStepInfos = {
    [TRIGGER_STEP_ID]: { status: StepStatus.SUCCESS, result: payload },
  };
  for (const step of steps) stepInfos[step.id] = { status: StepStatus.NOT_STARTED };
  return { flow: { trigger, steps }, stepInfos };
}
