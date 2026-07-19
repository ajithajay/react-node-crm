import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  TRIGGER_STEP_ID,
  WorkflowActionType,
  WorkflowTriggerType,
  type WorkflowStep,
  type WorkflowTrigger,
} from '@saasly/shared';
import { workflowApi } from '@/lib/api-client';
import { defaultStep, defaultTrigger } from '../lib/step-catalog';
import { newId } from '../lib/id';

interface Flow {
  trigger: WorkflowTrigger | null;
  steps: WorkflowStep[];
}

/**
 * Manages the editable draft of a workflow: local trigger+steps state, and persistence to the draft
 * version. A draft is only forked explicitly via `createDraft()` (the builder's "New Version"
 * button) — editing never silently forks one. Structural edits (add/delete/connect/config-save)
 * persist immediately — each is a discrete user action, so no debounce is needed.
 */
export function useWorkflowEditor(workflowId: string) {
  const queryClient = useQueryClient();
  const { data: workflow, isLoading } = useQuery({
    queryKey: ['workflow', workflowId],
    queryFn: () => workflowApi.get(workflowId),
  });

  const [flow, setFlow] = useState<Flow>({ trigger: null, steps: [] });
  const [draftVersionId, setDraftVersionId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Tracks which workflowId `flow`/`draftVersionId` were last seeded for — not just a one-shot flag —
  // so navigating between two workflows (e.g. via Duplicate's `navigate()` on the same route, with no
  // remount) re-seeds instead of leaving the previous workflow's steps/draft version showing.
  const initializedForId = useRef<string | null>(null);

  // Seed local state from the workflow's current version whenever `workflowId` changes.
  useEffect(() => {
    if (!workflow || initializedForId.current === workflowId) return;
    initializedForId.current = workflowId;
    const current = workflow.currentVersion;
    setFlow({ trigger: current?.trigger ?? null, steps: current?.steps ?? [] });
    setDraftVersionId(current?.status === 'DRAFT' ? current.id : null);
  }, [workflow, workflowId]);

  /** Explicit "New Version" action: fork (or reuse) a DRAFT version and switch the editor onto it. */
  const createDraft = useCallback(async (): Promise<string> => {
    if (draftVersionId) return draftVersionId;
    const draft = await workflowApi.getDraft(workflowId);
    setDraftVersionId(draft.id);
    setFlow({ trigger: draft.trigger, steps: draft.steps });
    await queryClient.invalidateQueries({ queryKey: ['workflow', workflowId] });
    return draft.id;
  }, [draftVersionId, queryClient, workflowId]);

  /** "Discard Draft": delete the in-progress draft and fall back to the workflow's active/last version. */
  const discardDraft = useCallback(async (): Promise<void> => {
    if (!draftVersionId) return;
    const updated = await workflowApi.discardDraft(workflowId);
    setDraftVersionId(null);
    setFlow({ trigger: updated.currentVersion?.trigger ?? null, steps: updated.currentVersion?.steps ?? [] });
    await queryClient.invalidateQueries({ queryKey: ['workflow', workflowId] });
    await queryClient.invalidateQueries({ queryKey: ['workflows'] });
  }, [draftVersionId, queryClient, workflowId]);

  const persist = useCallback(
    async (next: Flow) => {
      if (!draftVersionId) return; // editing requires an explicit draft (see createDraft/"New Version")
      setFlow(next);
      setSaving(true);
      try {
        await workflowApi.updateVersion(workflowId, draftVersionId, { trigger: next.trigger, steps: next.steps });
        await queryClient.invalidateQueries({ queryKey: ['workflow', workflowId] });
      } finally {
        setSaving(false);
      }
    },
    [draftVersionId, queryClient, workflowId],
  );

  // ── mutations ────────────────────────────────────────────────────────────────
  const setTriggerType = useCallback(
    (type: WorkflowTriggerType) => {
      const nextStepIds = flow.trigger?.nextStepIds ?? [];
      void persist({ ...flow, trigger: { ...defaultTrigger(type), nextStepIds } });
    },
    [flow, persist],
  );

  const updateTrigger = useCallback(
    (trigger: WorkflowTrigger) => void persist({ ...flow, trigger }),
    [flow, persist],
  );

  const deleteTrigger = useCallback(() => void persist({ ...flow, trigger: null }), [flow, persist]);

  const updateStep = useCallback(
    (step: WorkflowStep) =>
      void persist({ ...flow, steps: flow.steps.map((s) => (s.id === step.id ? step : s)) }),
    [flow, persist],
  );

  // `branch` routes the new edge for control-flow parents: an if-else branch id ('true'|'false')
  // adds to that branch's nextStepIds; 'loop' adds to an iterator's loop body; otherwise nextStepIds.
  const addStepAfter = useCallback(
    (parentId: string, type: WorkflowActionType, branch?: string): string => {
      const id = newId();
      const step = defaultStep(type, id);
      const steps = [...flow.steps, step];
      let trigger = flow.trigger;
      if (parentId === TRIGGER_STEP_ID && trigger) {
        trigger = { ...trigger, nextStepIds: [...(trigger.nextStepIds ?? []), id] };
      } else {
        for (let i = 0; i < steps.length; i++) {
          if (steps[i]!.id !== parentId) continue;
          steps[i] = wireChild(steps[i]!, id, branch);
        }
      }
      void persist({ trigger, steps });
      return id;
    },
    [flow, persist],
  );

  const deleteStep = useCallback(
    (id: string) => {
      const steps = flow.steps
        .filter((s) => s.id !== id)
        .map((s) => stripReferences(s, id));
      const trigger = flow.trigger
        ? { ...flow.trigger, nextStepIds: (flow.trigger.nextStepIds ?? []).filter((n) => n !== id) }
        : null;
      void persist({ trigger, steps });
    },
    [flow, persist],
  );

  return {
    workflow,
    isLoading,
    trigger: flow.trigger,
    steps: flow.steps,
    saving,
    isEditable: !!draftVersionId,
    createDraft,
    discardDraft,
    setTriggerType,
    updateTrigger,
    deleteTrigger,
    updateStep,
    addStepAfter,
    deleteStep,
  };
}

/** Wire a new child into a parent step, honoring if-else branches ('true'/'false') and iterator loops. */
function wireChild(parent: WorkflowStep, childId: string, branch?: string): WorkflowStep {
  const input = (parent.settings?.input ?? {}) as Record<string, unknown>;

  if (parent.type === WorkflowActionType.IF_ELSE && (branch === 'true' || branch === 'false')) {
    const branches = ((input.branches as { id: string; nextStepIds?: string[] }[] | undefined) ?? []).slice();
    const existing = branches.find((b) => b.id === branch);
    if (existing) {
      existing.nextStepIds = [...(existing.nextStepIds ?? []), childId];
    } else {
      branches.push({ id: branch, nextStepIds: [childId] });
    }
    return { ...parent, settings: { ...parent.settings, input: { ...input, branches } } };
  }

  if (parent.type === WorkflowActionType.ITERATOR && branch === 'loop') {
    const loop = ((input.initialLoopStepIds as string[] | undefined) ?? []).slice();
    loop.push(childId);
    return { ...parent, settings: { ...parent.settings, input: { ...input, initialLoopStepIds: loop } } };
  }

  return { ...parent, nextStepIds: [...(parent.nextStepIds ?? []), childId] };
}

/** Remove all edges pointing at `removedId` from a step (nextStepIds + if-else branches + iterator). */
function stripReferences(step: WorkflowStep, removedId: string): WorkflowStep {
  const next = { ...step, nextStepIds: (step.nextStepIds ?? []).filter((n) => n !== removedId) };
  const input = next.settings?.input as
    | { branches?: { nextStepIds?: string[] }[]; initialLoopStepIds?: string[] }
    | undefined;
  if (input?.branches || input?.initialLoopStepIds) {
    const newInput = { ...input } as Record<string, unknown>;
    if (input.branches) {
      newInput.branches = input.branches.map((b) => ({
        ...b,
        nextStepIds: (b.nextStepIds ?? []).filter((n) => n !== removedId),
      }));
    }
    if (input.initialLoopStepIds) {
      newInput.initialLoopStepIds = input.initialLoopStepIds.filter((n) => n !== removedId);
    }
    next.settings = { ...next.settings, input: newInput };
  }
  return next;
}
