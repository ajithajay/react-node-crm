import { IsNull, Not } from 'typeorm';
import {
  WorkflowEntity,
  WorkflowVersionEntity,
  WorkflowRunEntity,
  WorkflowAutomatedTriggerEntity,
} from '@saasly/database';
import {
  buildCronPattern,
  buildInitialRunState,
  ManualTriggerAvailability,
  parseManualAvailability,
  WorkflowRunStatus,
  WorkflowStatus,
  WorkflowTriggerType,
  WorkflowVersionStatus,
  type UpdateWorkflowVersionRequest,
  type WorkflowDetail,
  type WorkflowRunDetail,
  type WorkflowRunQuery,
  type WorkflowRunnableSummary,
  type WorkflowRunSummary,
  type WorkflowStep,
  type WorkflowSummary,
  type WorkflowTrigger,
  type WorkflowVersionDetail,
  type WorkflowVersionSummary,
} from '@saasly/shared';
import { dataSource } from '../../lib/db.js';
import { ConflictError, NotFoundError } from '../../lib/errors.js';
import {
  enqueueWorkflowExecution,
  removeCronTrigger,
  upsertCronTrigger,
} from '../../lib/queue.js';
import { record } from '../audit-log/audit-log.service.js';

const workflowRepo = () => dataSource.getRepository(WorkflowEntity);
const versionRepo = () => dataSource.getRepository(WorkflowVersionEntity);
const runRepo = () => dataSource.getRepository(WorkflowRunEntity);
const triggerRepo = () => dataSource.getRepository(WorkflowAutomatedTriggerEntity);

// ── mappers ───────────────────────────────────────────────────────────────────
function toVersionSummary(v: WorkflowVersionEntity): WorkflowVersionSummary {
  return {
    id: v.id,
    workflowId: v.workflowId,
    name: v.name,
    status: v.status as WorkflowVersionStatus,
    createdAt: v.createdAt.toISOString(),
    updatedAt: v.updatedAt.toISOString(),
  };
}

function toVersionDetail(v: WorkflowVersionEntity): WorkflowVersionDetail {
  return {
    ...toVersionSummary(v),
    trigger: (v.trigger as WorkflowTrigger | null) ?? null,
    steps: (v.steps as unknown as WorkflowStep[]) ?? [],
  };
}

function toSummary(w: WorkflowEntity): WorkflowSummary {
  return {
    id: w.id,
    name: w.name,
    statuses: (w.statuses as WorkflowStatus[]) ?? [],
    lastPublishedVersionId: w.lastPublishedVersionId,
    createdAt: w.createdAt.toISOString(),
    updatedAt: w.updatedAt.toISOString(),
  };
}

/**
 * Aggregate workflow-level statuses from its versions (drives the list badge). Reflects the
 * *current* meaningful state rather than a raw union — a stale DEACTIVATED/ARCHIVED version must
 * not keep showing once a fresh DRAFT/ACTIVE version supersedes it.
 */
function computeStatuses(versions: WorkflowVersionEntity[]): WorkflowStatus[] {
  const hasActive = versions.some((v) => v.status === WorkflowVersionStatus.ACTIVE);
  const hasDraft = versions.some((v) => v.status === WorkflowVersionStatus.DRAFT);
  const statuses: WorkflowStatus[] = [];
  if (hasActive) statuses.push(WorkflowStatus.ACTIVE);
  if (hasDraft) statuses.push(WorkflowStatus.DRAFT);
  if (
    !hasActive &&
    !hasDraft &&
    versions.some((v) => v.status === WorkflowVersionStatus.DEACTIVATED)
  ) {
    statuses.push(WorkflowStatus.DEACTIVATED);
  }
  return statuses;
}

async function refreshStatuses(workflowId: string): Promise<WorkflowEntity> {
  const workflow = await workflowRepo().findOneByOrFail({ id: workflowId });
  const versions = await versionRepo().findBy({ workflowId });
  workflow.statuses = computeStatuses(versions);
  return workflowRepo().save(workflow);
}

/** Pick the version the builder should show: DRAFT first, else ACTIVE, else newest. */
function pickCurrentVersion(versions: WorkflowVersionEntity[]): WorkflowVersionEntity | null {
  if (versions.length === 0) return null;
  const draft = versions.find((v) => v.status === WorkflowVersionStatus.DRAFT);
  if (draft) return draft;
  const active = versions.find((v) => v.status === WorkflowVersionStatus.ACTIVE);
  if (active) return active;
  return [...versions].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0] ?? null;
}

async function nextVersionName(workflowId: string): Promise<string> {
  const count = await versionRepo().countBy({ workflowId });
  return `v${count + 1}`;
}

// ── workflow CRUD ─────────────────────────────────────────────────────────────
export async function listWorkflows(workspaceId: string): Promise<WorkflowSummary[]> {
  const workflows = await workflowRepo().findBy({ workspaceId });
  return workflows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).map(toSummary);
}

/**
 * List active workflows whose PUBLISHED version has a MANUAL trigger available on the given surface
 * (global menu, a single record's action menu, or the bulk-selection bar) — and, for the
 * SINGLE_RECORD/BULK_RECORDS surfaces, scoped to the given object. Powers "Run workflow" entry
 * points outside the builder.
 */
export async function listRunnableWorkflows(
  workspaceId: string,
  availability: ManualTriggerAvailability,
  objectNameSingular?: string,
): Promise<WorkflowRunnableSummary[]> {
  const workflows = await workflowRepo().find({
    where: { workspaceId, lastPublishedVersionId: Not(IsNull()) },
  });
  if (!workflows.length) return [];

  const publishedIds = workflows.map((w) => w.lastPublishedVersionId!).filter(Boolean);
  const versions = await versionRepo().find({ where: publishedIds.map((id) => ({ id })) });
  const versionById = new Map(versions.map((v) => [v.id, v]));

  const results: WorkflowRunnableSummary[] = [];
  for (const workflow of workflows) {
    const version = versionById.get(workflow.lastPublishedVersionId!);
    const trigger = version?.trigger as { type?: string; settings?: Record<string, unknown> } | null;
    if (!trigger || trigger.type !== WorkflowTriggerType.MANUAL) continue;

    const target = parseManualAvailability(trigger.settings);
    if (target.type !== availability) continue;
    if (availability !== ManualTriggerAvailability.GLOBAL && target.objectNameSingular !== objectNameSingular) {
      continue;
    }

    results.push({
      id: workflow.id,
      name: workflow.name,
      icon: (trigger.settings?.icon as string) ?? null,
      isPinned: trigger.settings?.isPinned === true,
    });
  }
  return results;
}

export async function getWorkflow(workspaceId: string, id: string): Promise<WorkflowDetail> {
  const workflow = await workflowRepo().findOneBy({ id, workspaceId });
  if (!workflow) throw new NotFoundError('Workflow not found');

  const versions = await versionRepo().findBy({ workflowId: id });
  const current = pickCurrentVersion(versions);
  return {
    ...toSummary(workflow),
    currentVersion: current ? toVersionDetail(current) : null,
    versions: versions
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map(toVersionSummary),
  };
}

export async function createWorkflow(
  workspaceId: string,
  actorUserId: string,
  name: string,
): Promise<WorkflowDetail> {
  const workflow = await workflowRepo().save(
    workflowRepo().create({ workspaceId, name, statuses: [WorkflowStatus.DRAFT] }),
  );
  await versionRepo().save(
    versionRepo().create({
      workspaceId,
      workflowId: workflow.id,
      name: 'v1',
      status: WorkflowVersionStatus.DRAFT,
      trigger: null,
      steps: [],
    }),
  );

  await record(workspaceId, actorUserId, 'workflow.created', { workflowId: workflow.id, name });
  return getWorkflow(workspaceId, workflow.id);
}

export async function updateWorkflow(
  workspaceId: string,
  id: string,
  actorUserId: string,
  name: string,
): Promise<WorkflowDetail> {
  const workflow = await workflowRepo().findOneBy({ id, workspaceId });
  if (!workflow) throw new NotFoundError('Workflow not found');
  workflow.name = name;
  await workflowRepo().save(workflow);
  await record(workspaceId, actorUserId, 'workflow.updated', { workflowId: id, name });
  return getWorkflow(workspaceId, id);
}

export async function deleteWorkflow(
  workspaceId: string,
  id: string,
  actorUserId: string,
): Promise<void> {
  const workflow = await workflowRepo().findOneBy({ id, workspaceId });
  if (!workflow) throw new NotFoundError('Workflow not found');
  await onWorkflowDeactivated(workflow); // best-effort: drop any registered automated triggers
  await workflowRepo().softRemove(workflow);
  await record(workspaceId, actorUserId, 'workflow.deleted', { workflowId: id });
}

// ── version / draft model ─────────────────────────────────────────────────────
/**
 * Return the DRAFT version the builder can edit. If the current version is already a DRAFT, reuse it;
 * otherwise clone the current (active/newest) version into a fresh DRAFT — editing an active
 * workflow silently forks a draft.
 */
export async function getUpdatableVersion(
  workspaceId: string,
  workflowId: string,
  actorUserId: string,
): Promise<WorkflowVersionDetail> {
  const workflow = await workflowRepo().findOneBy({ id: workflowId, workspaceId });
  if (!workflow) throw new NotFoundError('Workflow not found');

  const versions = await versionRepo().findBy({ workflowId });
  const draft = versions.find((v) => v.status === WorkflowVersionStatus.DRAFT);
  if (draft) return toVersionDetail(draft);

  const source = pickCurrentVersion(versions);
  const newDraft = await versionRepo().save(
    versionRepo().create({
      workspaceId,
      workflowId,
      name: await nextVersionName(workflowId),
      status: WorkflowVersionStatus.DRAFT,
      trigger: source?.trigger ?? null,
      steps: source?.steps ?? [],
    }),
  );
  await refreshStatuses(workflowId);
  await record(workspaceId, actorUserId, 'workflow.version_created', {
    workflowId,
    versionId: newDraft.id,
  });
  return toVersionDetail(newDraft);
}

export async function updateVersion(
  workspaceId: string,
  workflowId: string,
  versionId: string,
  actorUserId: string,
  input: UpdateWorkflowVersionRequest,
): Promise<WorkflowVersionDetail> {
  const version = await versionRepo().findOneBy({ id: versionId, workflowId, workspaceId });
  if (!version) throw new NotFoundError('Workflow version not found');
  if (version.status !== WorkflowVersionStatus.DRAFT) {
    throw new ConflictError('Only draft versions can be edited');
  }

  if (input.trigger !== undefined) version.trigger = input.trigger as Record<string, unknown> | null;
  if (input.steps !== undefined) version.steps = input.steps as unknown as Record<string, unknown>[];
  await versionRepo().save(version);
  await record(workspaceId, actorUserId, 'workflow.updated', { workflowId, versionId });
  return toVersionDetail(version);
}

/**
 * Discard the workflow's current DRAFT version (abandoning unpublished edits). Refuses when there's
 * no draft, or when the draft is the workflow's only version — nothing would remain for the builder
 * to show.
 */
export async function discardDraft(
  workspaceId: string,
  workflowId: string,
  actorUserId: string,
): Promise<WorkflowDetail> {
  const workflow = await workflowRepo().findOneBy({ id: workflowId, workspaceId });
  if (!workflow) throw new NotFoundError('Workflow not found');

  const versions = await versionRepo().findBy({ workflowId });
  const draft = versions.find((v) => v.status === WorkflowVersionStatus.DRAFT);
  if (!draft) throw new ConflictError('No draft version to discard');
  if (versions.length === 1) {
    throw new ConflictError('Cannot discard the only version of a workflow');
  }

  await versionRepo().remove(draft);
  await refreshStatuses(workflowId);
  await record(workspaceId, actorUserId, 'workflow.draft_discarded', {
    workflowId,
    versionId: draft.id,
  });
  return getWorkflow(workspaceId, workflowId);
}

export async function listVersions(
  workspaceId: string,
  workflowId: string,
): Promise<WorkflowVersionSummary[]> {
  const workflow = await workflowRepo().findOneBy({ id: workflowId, workspaceId });
  if (!workflow) throw new NotFoundError('Workflow not found');
  const versions = await versionRepo().findBy({ workflowId });
  return versions
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .map(toVersionSummary);
}

// ── activate / deactivate ─────────────────────────────────────────────────────
export async function activateWorkflow(
  workspaceId: string,
  workflowId: string,
  actorUserId: string,
): Promise<WorkflowDetail> {
  const workflow = await workflowRepo().findOneBy({ id: workflowId, workspaceId });
  if (!workflow) throw new NotFoundError('Workflow not found');

  const versions = await versionRepo().findBy({ workflowId });
  const draft = versions.find((v) => v.status === WorkflowVersionStatus.DRAFT);
  const active = versions.find((v) => v.status === WorkflowVersionStatus.ACTIVE);
  // No draft/active? This is a simple re-enable of a deactivated workflow (no edits pending) — reuse
  // its most-recently-deactivated version rather than forcing the user through "New Version" first.
  const mostRecentlyDeactivated = versions
    .filter((v) => v.status === WorkflowVersionStatus.DEACTIVATED)
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0];
  const target = draft ?? active ?? mostRecentlyDeactivated;
  if (!target) throw new ConflictError('No draft version to activate');
  if (!target.trigger) throw new ConflictError('Add a trigger before activating this workflow');

  await dataSource.transaction(async (manager) => {
    // Demote any currently-active/other version to ARCHIVED.
    for (const v of versions) {
      if (v.id !== target.id && v.status === WorkflowVersionStatus.ACTIVE) {
        v.status = WorkflowVersionStatus.ARCHIVED;
        await manager.save(v);
      }
    }
    target.status = WorkflowVersionStatus.ACTIVE;
    await manager.save(target);
    workflow.lastPublishedVersionId = target.id;
    await manager.save(workflow);
  });

  await onWorkflowActivated(workflow, target);
  await refreshStatuses(workflowId);
  await record(workspaceId, actorUserId, 'workflow.activated', {
    workflowId,
    versionId: target.id,
  });
  return getWorkflow(workspaceId, workflowId);
}

export async function deactivateWorkflow(
  workspaceId: string,
  workflowId: string,
  actorUserId: string,
): Promise<WorkflowDetail> {
  const workflow = await workflowRepo().findOneBy({ id: workflowId, workspaceId });
  if (!workflow) throw new NotFoundError('Workflow not found');

  const active = await versionRepo().findOneBy({
    workflowId,
    status: WorkflowVersionStatus.ACTIVE,
  });
  if (active) {
    active.status = WorkflowVersionStatus.DEACTIVATED;
    await versionRepo().save(active);
  }
  workflow.lastPublishedVersionId = null;
  await workflowRepo().save(workflow);

  await onWorkflowDeactivated(workflow);
  await refreshStatuses(workflowId);
  await record(workspaceId, actorUserId, 'workflow.deactivated', { workflowId });
  return getWorkflow(workspaceId, workflowId);
}

export async function duplicateWorkflow(
  workspaceId: string,
  workflowId: string,
  actorUserId: string,
): Promise<WorkflowDetail> {
  const source = await workflowRepo().findOneBy({ id: workflowId, workspaceId });
  if (!source) throw new NotFoundError('Workflow not found');
  const versions = await versionRepo().findBy({ workflowId });
  const current = pickCurrentVersion(versions);

  const copy = await workflowRepo().save(
    workflowRepo().create({
      workspaceId,
      name: `${source.name} (copy)`,
      statuses: [WorkflowStatus.DRAFT],
    }),
  );
  await versionRepo().save(
    versionRepo().create({
      workspaceId,
      workflowId: copy.id,
      name: 'v1',
      status: WorkflowVersionStatus.DRAFT,
      trigger: current?.trigger ?? null,
      steps: current?.steps ?? [],
    }),
  );
  await record(workspaceId, actorUserId, 'workflow.created', { workflowId: copy.id, from: workflowId });
  return getWorkflow(workspaceId, copy.id);
}

// ── runs (read side; execution lands in 8d) ───────────────────────────────────
export async function listRuns(
  workspaceId: string,
  query: WorkflowRunQuery,
): Promise<{ items: WorkflowRunSummary[]; total: number; page: number; pageSize: number }> {
  const qb = runRepo()
    .createQueryBuilder('run')
    .where('run.workspace_id = :workspaceId', { workspaceId });
  if (query.workflowId) qb.andWhere('run.workflow_id = :workflowId', { workflowId: query.workflowId });
  if (query.status) qb.andWhere('run.status = :status', { status: query.status });

  const total = await qb.getCount();
  const runs = await qb
    .orderBy('run.created_at', 'DESC')
    .skip((query.page - 1) * query.pageSize)
    .take(query.pageSize)
    .getMany();

  const workflowNames = await workflowNameMap(runs.map((r) => r.workflowId));
  return {
    items: runs.map((r) => toRunSummary(r, workflowNames.get(r.workflowId) ?? 'Workflow')),
    total,
    page: query.page,
    pageSize: query.pageSize,
  };
}

export async function getRun(workspaceId: string, runId: string): Promise<WorkflowRunDetail> {
  const run = await runRepo().findOneBy({ id: runId, workspaceId });
  if (!run) throw new NotFoundError('Workflow run not found');
  const workflow = await workflowRepo().findOneBy({ id: run.workflowId });
  return {
    ...toRunSummary(run, workflow?.name ?? 'Workflow'),
    state: (run.state as unknown as WorkflowRunDetail['state']) ?? {
      flow: { trigger: null, steps: [] },
      stepInfos: {},
    },
  };
}

async function workflowNameMap(workflowIds: string[]): Promise<Map<string, string>> {
  const ids = [...new Set(workflowIds)];
  if (ids.length === 0) return new Map();
  const workflows = await workflowRepo().find({ where: ids.map((id) => ({ id })) });
  return new Map(workflows.map((w) => [w.id, w.name]));
}

function toRunSummary(run: WorkflowRunEntity, workflowName: string): WorkflowRunSummary {
  return {
    id: run.id,
    workflowId: run.workflowId,
    workflowName,
    workflowVersionId: run.workflowVersionId,
    status: run.status as WorkflowRunSummary['status'],
    enqueuedAt: run.enqueuedAt?.toISOString() ?? null,
    startedAt: run.startedAt?.toISOString() ?? null,
    endedAt: run.endedAt?.toISOString() ?? null,
    createdAt: run.createdAt.toISOString(),
  };
}

// ── run creation + manual trigger ─────────────────────────────────────────────
/**
 * Create a WorkflowRun that snapshots `version`'s flow (so later edits don't affect it), seeds the
 * per-step state (trigger result = `payload`), and enqueues execution. Shared by the manual-run
 * endpoint and the automated triggers (8e).
 */
export async function createAndEnqueueRun(
  workspaceId: string,
  workflowId: string,
  version: WorkflowVersionEntity,
  payload: Record<string, unknown>,
  createdBy: string | null,
): Promise<WorkflowRunEntity> {
  const trigger = (version.trigger as WorkflowTrigger | null) ?? null;
  const steps = (version.steps as unknown as WorkflowStep[]) ?? [];
  const state = buildInitialRunState(trigger, steps, payload);

  const run = await runRepo().save(
    runRepo().create({
      workspaceId,
      workflowId,
      workflowVersionId: version.id,
      status: WorkflowRunStatus.NOT_STARTED,
      state: state as unknown as Record<string, unknown>,
      createdBy,
      enqueuedAt: new Date(),
    }),
  );

  await enqueueWorkflowExecution({ workspaceId, workflowRunId: run.id });
  return run;
}

/** Pick the version a trigger should run: the published one if set, else the current draft (for testing). */
async function resolveRunnableVersion(
  workspaceId: string,
  workflow: WorkflowEntity,
): Promise<WorkflowVersionEntity> {
  if (workflow.lastPublishedVersionId) {
    const published = await versionRepo().findOneBy({
      id: workflow.lastPublishedVersionId,
      workspaceId,
    });
    if (published) return published;
  }
  const versions = await versionRepo().findBy({ workflowId: workflow.id });
  const current = pickCurrentVersion(versions);
  if (!current) throw new ConflictError('Workflow has no version to run');
  return current;
}

/** Public webhook entry point: run the published version only if it has an ACTIVE WEBHOOK trigger. */
export async function triggerWebhookRun(
  workspaceId: string,
  workflowId: string,
  payload: Record<string, unknown>,
): Promise<WorkflowRunEntity> {
  const workflow = await workflowRepo().findOneBy({ id: workflowId, workspaceId });
  if (!workflow?.lastPublishedVersionId) throw new NotFoundError('No active webhook workflow');
  const version = await versionRepo().findOneBy({ id: workflow.lastPublishedVersionId, workspaceId });
  const trigger = version?.trigger as { type?: string } | null;
  if (!version || trigger?.type !== WorkflowTriggerType.WEBHOOK) {
    throw new NotFoundError('No active webhook trigger for this workflow');
  }
  return createAndEnqueueRun(workspaceId, workflowId, version, payload, null);
}

/** Trigger a run of a workflow's published version (used by record-event + webhook triggers). */
export async function triggerWorkflowRun(
  workspaceId: string,
  workflowId: string,
  payload: Record<string, unknown>,
): Promise<WorkflowRunEntity | null> {
  const workflow = await workflowRepo().findOneBy({ id: workflowId, workspaceId });
  if (!workflow || !workflow.lastPublishedVersionId) return null;
  const version = await versionRepo().findOneBy({ id: workflow.lastPublishedVersionId, workspaceId });
  if (!version || !version.trigger) return null;
  return createAndEnqueueRun(workspaceId, workflowId, version, payload, null);
}

export async function runWorkflowManually(
  workspaceId: string,
  workflowId: string,
  actorUserId: string,
  payload: Record<string, unknown>,
): Promise<WorkflowRunSummary> {
  const workflow = await workflowRepo().findOneBy({ id: workflowId, workspaceId });
  if (!workflow) throw new NotFoundError('Workflow not found');
  const version = await resolveRunnableVersion(workspaceId, workflow);
  if (!version.trigger) throw new ConflictError('Add a trigger before running this workflow');

  const run = await createAndEnqueueRun(workspaceId, workflowId, version, payload, actorUserId);
  await record(workspaceId, actorUserId, 'workflow.run_triggered', { workflowId, runId: run.id, source: 'manual' });
  return toRunSummary(run, workflow.name);
}

// ── form action (public pause/resume) ─────────────────────────────────────────
export interface PendingForm {
  workflowName: string;
  status: string;
  title: string;
  fields: { id: string; name: string; label: string; type: string }[];
}

/** Fetch a paused FORM step's definition for the public form page. */
export async function getPendingForm(
  workspaceId: string,
  runId: string,
  stepId: string,
): Promise<PendingForm> {
  const run = await runRepo().findOneBy({ id: runId, workspaceId });
  if (!run) throw new NotFoundError('Run not found');
  const state = run.state as { flow?: { steps?: WorkflowStep[] }; stepInfos?: Record<string, { status?: string }> };
  const step = state.flow?.steps?.find((s) => s.id === stepId);
  if (!step) throw new NotFoundError('Form step not found');
  const info = state.stepInfos?.[stepId];
  const workflow = await workflowRepo().findOneBy({ id: run.workflowId });
  const input = (step.settings?.input ?? {}) as { title?: string; fields?: PendingForm['fields'] };
  return {
    workflowName: workflow?.name ?? 'Workflow',
    status: info?.status ?? 'NOT_STARTED',
    title: input.title ?? 'Please provide input',
    fields: input.fields ?? [],
  };
}

/** Record a form submission as the step's result and resume the run. */
export async function submitForm(
  workspaceId: string,
  runId: string,
  stepId: string,
  values: Record<string, unknown>,
): Promise<void> {
  const run = await runRepo().findOneBy({ id: runId, workspaceId });
  if (!run) throw new NotFoundError('Run not found');
  const state = run.state as { stepInfos?: Record<string, { status?: string; result?: unknown }> };
  const info = state.stepInfos?.[stepId];
  if (!info || info.status !== 'PENDING') throw new ConflictError('This form is no longer awaiting input');

  info.result = values; // executor's resume keeps this result and flips PENDING → SUCCESS
  run.state = state as unknown as Record<string, unknown>;
  await runRepo().save(run);
  await enqueueWorkflowExecution({ workspaceId, workflowRunId: runId, resumeStepId: stepId });
}

// ── activation side-effects: register/unregister automated triggers ───────────
/**
 * On activation, register the published version's automatic listeners: a DATABASE_EVENT trigger
 * inserts a `workflow_automated_triggers` row (queried by the record-event dispatcher); a CRON trigger
 * inserts a row + a BullMQ repeatable job. MANUAL/WEBHOOK register nothing (invoked on demand).
 */
async function onWorkflowActivated(
  workflow: WorkflowEntity,
  version: WorkflowVersionEntity,
): Promise<void> {
  await onWorkflowDeactivated(workflow); // clean slate before re-registering
  const trigger = version.trigger as { type?: string; settings?: Record<string, unknown> } | null;
  if (!trigger) return;

  if (trigger.type === WorkflowTriggerType.DATABASE_EVENT) {
    await triggerRepo().save(
      triggerRepo().create({
        workspaceId: workflow.workspaceId,
        workflowId: workflow.id,
        type: WorkflowTriggerType.DATABASE_EVENT,
        settings: {
          objectName: trigger.settings?.objectName ?? '',
          event: trigger.settings?.event ?? 'created',
          // Persist the trigger's watched fields + condition filter so the dispatcher can apply them.
          fields: trigger.settings?.fields ?? null,
          filter: trigger.settings?.filter ?? null,
        },
      }),
    );
  } else if (trigger.type === WorkflowTriggerType.CRON) {
    const pattern = buildCronPattern(trigger.settings ?? {});
    if (pattern) {
      await triggerRepo().save(
        triggerRepo().create({
          workspaceId: workflow.workspaceId,
          workflowId: workflow.id,
          type: WorkflowTriggerType.CRON,
          settings: { pattern },
        }),
      );
      await upsertCronTrigger({ workspaceId: workflow.workspaceId, workflowId: workflow.id }, pattern);
    }
  }
}

async function onWorkflowDeactivated(workflow: WorkflowEntity): Promise<void> {
  await triggerRepo().delete({ workflowId: workflow.id });
  await removeCronTrigger(workflow.id);
}
