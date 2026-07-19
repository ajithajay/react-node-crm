import { WorkflowRunEntity } from '@saasly/database';
import {
  StepStatus,
  WorkflowActionType,
  WorkflowRunStatus,
  getWorkflowRunContext,
  resolveInput,
  type WorkflowExecutionJobData,
  type WorkflowRunState,
  type WorkflowRunStepInfos,
  type WorkflowStep,
} from '@saasly/shared';
import { dataSource } from '../../lib/db.js';
import { logger } from '../../lib/logger.js';
import { enqueueWorkflowExecution } from './queue.js';
import { runAction } from './actions.js';

const MAX_STEPS_PER_RUN = 500;
const TERMINAL: ReadonlySet<string> = new Set([
  StepStatus.SUCCESS,
  StepStatus.FAILED,
  StepStatus.FAILED_SAFELY,
  StepStatus.SKIPPED,
]);
/** Run-level terminal statuses: once here, no resume/duplicate delivery should touch the run again. */
const TERMINAL_RUN_STATUSES: ReadonlySet<string> = new Set([
  WorkflowRunStatus.COMPLETED,
  WorkflowRunStatus.FAILED,
  WorkflowRunStatus.STOPPED,
]);

const runRepo = () => dataSource.getRepository(WorkflowRunEntity);

/**
 * Entry point for a WORKFLOW_EXECUTION job. Holds a Postgres advisory lock keyed by the run id for
 * the whole execution, so two concurrent deliveries of the same run (e.g. a BullMQ stalled-job
 * requeue while the first attempt is still mid-flight) can't both execute the same non-idempotent
 * side-effecting steps — the second delivery blocks until the first's lock is released (on success,
 * failure, or the holding connection dying on crash) before touching the run at all.
 */
export async function executeRun(job: WorkflowExecutionJobData): Promise<void> {
  const queryRunner = dataSource.createQueryRunner();
  await queryRunner.connect();
  try {
    await queryRunner.query('SELECT pg_advisory_lock(hashtext($1))', [job.workflowRunId]);
    await executeRunLocked(job);
  } finally {
    await queryRunner.query('SELECT pg_advisory_unlock(hashtext($1))', [job.workflowRunId]).catch(() => {});
    await queryRunner.release();
  }
}

async function executeRunLocked(job: WorkflowExecutionJobData): Promise<void> {
  const run = await runRepo().findOneBy({ id: job.workflowRunId, workspaceId: job.workspaceId });
  if (!run) {
    logger.warn({ runId: job.workflowRunId }, '[workflow] run not found');
    return;
  }
  const state = run.state as unknown as WorkflowRunState;
  const stepById = new Map(state.flow.steps.map((s) => [s.id, s]));

  let frontier: string[];
  if (job.resumeStepId) {
    // A stray resume can't resurrect an already-finished run (e.g. one that hard-failed via a
    // sibling branch after this resume was already enqueued).
    if (TERMINAL_RUN_STATUSES.has(run.status)) return;
    // A DELAY elapsed (or a FORM was submitted): finish that step and continue.
    const info = state.stepInfos[job.resumeStepId];
    if (info && info.status === StepStatus.PENDING) {
      info.status = StepStatus.SUCCESS;
      info.endedAt = new Date().toISOString();
    }
    const step = stepById.get(job.resumeStepId);
    frontier = step ? nextStepIds(step, undefined) : [];
  } else {
    // Only a run-level TERMINAL status means "already handled, nothing to do" — a run stuck in
    // RUNNING (e.g. the previous holder crashed mid-flight, after persisting the RUNNING transition
    // but before finishing) is exclusively ours now that we hold the lock, so resume it instead of
    // silently no-oping forever.
    if (TERMINAL_RUN_STATUSES.has(run.status)) return;
    const wasAlreadyRunning = run.status === WorkflowRunStatus.RUNNING;
    run.status = WorkflowRunStatus.RUNNING;
    run.startedAt ??= new Date();
    await runRepo().save(run);
    frontier = wasAlreadyRunning ? computeResumeFrontier(state, stepById) : (state.flow.trigger?.nextStepIds ?? []);
  }

  const ctx = { run, state, stepById, delays: [] as { stepId: string; delayMs: number }[], failed: false };
  await processFrontier(ctx, frontier);

  await persist(run, state);
  await finalize(ctx);
}

/**
 * Re-derives the execution frontier from persisted step progress after a crash: walks the graph
 * from the trigger, skipping past already-terminal steps to their children (so completed work isn't
 * re-queued), and stops at the first non-terminal, non-pending step on each branch.
 */
function computeResumeFrontier(state: WorkflowRunState, stepById: Map<string, WorkflowStep>): string[] {
  const frontier: string[] = [];
  const seen = new Set<string>();
  const visit = (ids: string[]): void => {
    for (const id of ids) {
      if (seen.has(id)) continue;
      seen.add(id);
      const step = stepById.get(id);
      if (!step) continue;
      const info = state.stepInfos[id];
      if (info && TERMINAL.has(info.status)) {
        const branch = (info.result as { matched?: 'true' | 'false' } | undefined)?.matched;
        visit(nextStepIds(step, branch));
      } else if (!info || info.status !== StepStatus.PENDING) {
        frontier.push(id);
      }
      // PENDING steps (DELAY/FORM) already have their own resume job enqueued; leave them be.
    }
  };
  visit(state.flow.trigger?.nextStepIds ?? []);
  return frontier;
}

interface Ctx {
  run: WorkflowRunEntity;
  state: WorkflowRunState;
  stepById: Map<string, WorkflowStep>;
  delays: { stepId: string; delayMs: number }[];
  failed: boolean;
}

async function processFrontier(ctx: Ctx, frontier: string[]): Promise<void> {
  const queue = [...frontier];
  let executed = 0;

  while (queue.length > 0 && executed < MAX_STEPS_PER_RUN) {
    const id = queue.shift()!;
    const info = ctx.state.stepInfos[id];
    if (info && TERMINAL.has(info.status)) continue;
    const step = ctx.stepById.get(id);
    if (!step) continue;

    executed += 1;
    const context = getWorkflowRunContext(ctx.state.stepInfos);
    const input = resolveInput(step.settings?.input, context) as Record<string, unknown>;

    // Iterators run their loop body per item and then continue to their own successors.
    if (step.type === WorkflowActionType.ITERATOR) {
      setStatus(ctx, id, StepStatus.RUNNING, input);
      await runIterator(ctx, step, input, context);
      queue.push(...(step.nextStepIds ?? []));
      await persist(ctx.run, ctx.state);
      continue;
    }

    setStatus(ctx, id, StepStatus.RUNNING, input);
    let output;
    try {
      output = await runAction(ctx.run.workspaceId, step, input, context);
    } catch (err) {
      output = { error: (err as Error).message };
    }

    if (output.pending) {
      const result =
        step.type === WorkflowActionType.FORM
          ? { ...(output.result as object), formPath: `/forms/${ctx.run.workspaceId}/${ctx.run.id}/${id}` }
          : output.result;
      ctx.state.stepInfos[id] = {
        ...ctx.state.stepInfos[id],
        status: StepStatus.PENDING,
        result,
      };
      if (output.delayMs != null) ctx.delays.push({ stepId: id, delayMs: output.delayMs });
      await persist(ctx.run, ctx.state);
      continue; // pause this branch; siblings keep running
    }

    if (output.error) {
      const continueOnFailure = step.settings?.errorHandlingOptions?.continueOnFailure?.value === true;
      if (continueOnFailure) {
        finish(ctx, id, StepStatus.FAILED_SAFELY, { error: output.error });
        queue.push(...nextStepIds(step, output.branch));
      } else {
        finish(ctx, id, StepStatus.FAILED, { error: output.error });
        ctx.failed = true;
        await persist(ctx.run, ctx.state);
        return; // hard failure stops the whole run
      }
    } else {
      finish(ctx, id, StepStatus.SUCCESS, { result: output.result });
      if (!output.halt) queue.push(...nextStepIds(step, output.branch));
    }
    await persist(ctx.run, ctx.state);
  }
}

/** Run an iterator's loop body once per item, with `{{<iteratorId>.currentItem}}` in scope. */
async function runIterator(
  ctx: Ctx,
  step: WorkflowStep,
  input: Record<string, unknown>,
  baseContext: Record<string, unknown>,
): Promise<void> {
  const items = Array.isArray(input.items) ? input.items : [];
  const loopStart = ((step.settings?.input as Record<string, unknown>)?.initialLoopStepIds as string[]) ?? [];
  const continueOnFailure = (step.settings?.input as Record<string, unknown>)?.shouldContinueOnIterationFailure === true;
  let failedIterations = 0;

  for (let index = 0; index < items.length; index++) {
    const iterContext = { ...baseContext, [step.id]: { currentItem: items[index], index } };
    // Walk the loop-body chain for this item (side-effect actions; results are transient per iteration).
    const chain = [...loopStart];
    let guard = 0;
    let iterationFailed = false;
    while (chain.length > 0 && guard < MAX_STEPS_PER_RUN) {
      guard += 1;
      const bodyId = chain.shift()!;
      const bodyStep = ctx.stepById.get(bodyId);
      if (!bodyStep || bodyStep.type === WorkflowActionType.ITERATOR) continue;
      const bodyInput = resolveInput(bodyStep.settings?.input, iterContext) as Record<string, unknown>;
      try {
        const out = await runAction(ctx.run.workspaceId, bodyStep, bodyInput, iterContext);
        if (out.error) throw new Error(out.error);
        if (!out.halt) chain.push(...(bodyStep.nextStepIds ?? []));
      } catch (err) {
        iterationFailed = true;
        logger.warn({ err, bodyId, index }, '[workflow] iterator body step failed');
        if (!continueOnFailure) break;
      }
    }
    if (iterationFailed) {
      failedIterations += 1;
      if (!continueOnFailure) {
        finish(ctx, step.id, StepStatus.FAILED, { error: `Iteration ${index + 1} failed` });
        ctx.failed = true;
        return;
      }
    }
  }
  finish(ctx, step.id, StepStatus.SUCCESS, { result: { count: items.length, failedIterations } });
}

/** Resolve a step's outgoing ids, honoring an if-else branch choice. */
function nextStepIds(step: WorkflowStep, branch: 'true' | 'false' | undefined): string[] {
  if (step.type === WorkflowActionType.IF_ELSE && branch) {
    const branches = ((step.settings?.input as Record<string, unknown>)?.branches as
      | { id: string; nextStepIds?: string[] }[]
      | undefined) ?? [];
    return branches.find((b) => b.id === branch)?.nextStepIds ?? [];
  }
  return step.nextStepIds ?? [];
}

function setStatus(ctx: Ctx, id: string, status: StepStatus, input?: unknown): void {
  ctx.state.stepInfos[id] = {
    ...ctx.state.stepInfos[id],
    status,
    ...(input !== undefined ? { input } : {}),
    startedAt: ctx.state.stepInfos[id]?.startedAt ?? new Date().toISOString(),
  };
}

/** Merges onto the existing entry (not a replace) so the `input` captured by `setStatus` survives. */
function finish(ctx: Ctx, id: string, status: StepStatus, extra: { result?: unknown; error?: string }): void {
  ctx.state.stepInfos[id] = {
    ...ctx.state.stepInfos[id],
    status,
    result: extra.result,
    error: extra.error,
    startedAt: ctx.state.stepInfos[id]?.startedAt ?? new Date().toISOString(),
    endedAt: new Date().toISOString(),
  };
}

async function persist(run: WorkflowRunEntity, state: WorkflowRunState): Promise<void> {
  run.state = state as unknown as Record<string, unknown>;
  await runRepo().save(run);
}

async function finalize(ctx: Ctx): Promise<void> {
  const hasPending = Object.values(ctx.state.stepInfos as WorkflowRunStepInfos).some(
    (i) => i.status === StepStatus.PENDING,
  );

  if (ctx.delays.length > 0 && !ctx.failed) {
    // Re-enqueue a resume job per delayed step; the run stays RUNNING meanwhile. Skipped entirely
    // when this invocation hard-failed the run (via a sibling branch) — a delayed step from a
    // failed run must not get a resume job that could later flip it back to RUNNING/COMPLETED.
    for (const d of ctx.delays) {
      await enqueueWorkflowExecution(
        { workspaceId: ctx.run.workspaceId, workflowRunId: ctx.run.id, resumeStepId: d.stepId },
        { delayMs: d.delayMs },
      );
    }
  }

  if (ctx.failed) {
    ctx.run.status = WorkflowRunStatus.FAILED;
    ctx.run.endedAt = new Date();
  } else if (hasPending || ctx.delays.length > 0) {
    ctx.run.status = WorkflowRunStatus.RUNNING; // waiting on delay/form resume
  } else {
    ctx.run.status = WorkflowRunStatus.COMPLETED;
    ctx.run.endedAt = new Date();
  }
  await runRepo().save(ctx.run);
}
