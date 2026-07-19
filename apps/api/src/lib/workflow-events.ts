import { WorkflowAutomatedTriggerEntity } from '@saasly/database';
import {
  WorkflowTriggerType,
  evaluateConditions,
  resolveInput,
  type StepFilter,
  type StepFilterGroup,
} from '@saasly/shared';
import { dataSource } from './db.js';
import { logger } from './logger.js';
import { triggerWorkflowRun } from '../modules/workflow/workflow.service.js';

/**
 * Fan a record mutation out to every DATABASE_EVENT workflow whose trigger matches, enqueuing one run
 * each (payload `{ record }` → `{{trigger.record.*}}`). Sits beside `dispatchRecordWebhooks` in
 * `record.service#afterRecordMutation`. Best-effort: a dispatch failure never fails the mutation.
 *
 * Deliberate v1 scope: workflow record actions do NOT re-enter this dispatch (see record-access.ts in
 * the worker) — automated triggers only fire for user/API-key record mutations, avoiding trigger loops.
 */
export async function dispatchWorkflowTriggers(
  workspaceId: string,
  objectName: string,
  operation: 'created' | 'updated' | 'deleted',
  record: Record<string, unknown>,
  changedFields?: string[],
): Promise<void> {
  try {
    const triggers = await dataSource.getRepository(WorkflowAutomatedTriggerEntity).findBy({
      workspaceId,
      type: WorkflowTriggerType.DATABASE_EVENT,
    });

    const matched = triggers.filter((t) => {
      const settings = t.settings as TriggerSettings;
      if (settings.objectName !== objectName) return false;
      const event = settings.event ?? 'created';
      const eventMatches =
        event === 'created-or-updated' ? operation === 'created' || operation === 'updated' : event === operation;
      if (!eventMatches) return false;

      // Watched fields (updated only): fire only if one of the listed fields actually changed.
      if (operation === 'updated' && settings.fields?.length && changedFields) {
        if (!settings.fields.some((f) => changedFields.includes(f))) return false;
      }

      // Condition filter: resolve `{{trigger.record.*}}` against this record, then evaluate.
      if (settings.filter?.stepFilters?.length) {
        const context = { trigger: { record } };
        const resolved = settings.filter.stepFilters.map(
          (sf) => resolveInput(sf, context) as StepFilter,
        );
        if (!evaluateConditions(resolved, settings.filter.stepFilterGroups ?? [])) return false;
      }
      return true;
    });

    await Promise.all(
      matched.map((t) => triggerWorkflowRun(workspaceId, t.workflowId, { record, operation })),
    );
  } catch (err) {
    logger.error({ err, workspaceId, objectName, operation }, 'workflow trigger dispatch failed');
  }
}

interface TriggerSettings {
  objectName?: string;
  event?: string;
  fields?: string[] | null;
  filter?: { stepFilters?: StepFilter[]; stepFilterGroups?: StepFilterGroup[] } | null;
}
