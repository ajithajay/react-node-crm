import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Play } from 'lucide-react';
import { WorkflowActionType, type ManualTriggerAvailability } from '@saasly/shared';
import { workflowApi } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { getIcon } from '@/lib/icons';
import { cn } from '@/lib/utils';
import { FormFields } from './FormFields';

interface Props {
  availability: ManualTriggerAvailability;
  objectNameSingular?: string;
  buildPayload: () => Record<string, unknown>;
  onRun?: () => void;
  className?: string;
}

/** Poll a just-started run briefly to see if it's already paused on a FORM step. */
async function findPendingFormStep(runId: string): Promise<string | null> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const run = await workflowApi.getRun(runId);
    const stepInfos = run.state?.stepInfos ?? {};
    const pendingStepId = Object.keys(stepInfos).find((sid) => stepInfos[sid]?.status === 'PENDING');
    if (pendingStepId) {
      const step = run.state?.flow.steps.find((s) => s.id === pendingStepId);
      return step?.type === WorkflowActionType.FORM ? pendingStepId : null;
    }
    if (['COMPLETED', 'FAILED', 'STOPPED'].includes(run.status)) return null;
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  return null;
}

/**
 * Renders the MANUAL-trigger workflows runnable on a given surface: pinned ones as always-visible
 * one-click icon buttons, unpinned ones tucked into a "Run workflow" dropdown — mirrors twenty's
 * pinned/unpinned split without needing its right-click-menu/edit-mode machinery.
 *
 * If the run immediately pauses on a FORM step, its form is collected inline in a popup instead of
 * navigating to the run page — submit closes the popup and the user stays where they were.
 */
export function RunWorkflowActions({ availability, objectNameSingular, buildPayload, onRun, className }: Props) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [formPopup, setFormPopup] = useState<{ runId: string; stepId: string } | null>(null);
  const [formValues, setFormValues] = useState<Record<string, unknown>>({});

  const { data: workflows } = useQuery({
    queryKey: ['workflows-runnable', availability, objectNameSingular],
    queryFn: () => workflowApi.listRunnable(availability, objectNameSingular),
    enabled: availability === 'GLOBAL' || !!objectNameSingular,
  });

  const runMutation = useMutation({
    mutationFn: (workflowId: string) => workflowApi.run(workflowId, buildPayload()),
    onSuccess: async (run) => {
      const pendingStepId = await findPendingFormStep(run.id);
      if (pendingStepId) {
        setFormValues({});
        setFormPopup({ runId: run.id, stepId: pendingStepId });
        return;
      }
      onRun?.();
      navigate(`/workflows/runs/${run.id}`);
    },
  });

  const { data: pendingForm } = useQuery({
    queryKey: ['workflow-run-form', formPopup?.runId, formPopup?.stepId],
    queryFn: () => workflowApi.getPendingForm(formPopup!.runId, formPopup!.stepId),
    enabled: !!formPopup,
  });

  const submitFormMutation = useMutation({
    mutationFn: () => workflowApi.submitPendingForm(formPopup!.runId, formPopup!.stepId, formValues),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['workflow-runs'] });
      setFormPopup(null);
      onRun?.();
    },
  });

  if (!workflows?.length) return null;
  const pinned = workflows.filter((w) => w.isPinned);
  const unpinned = workflows.filter((w) => !w.isPinned);

  return (
    <div className={cn('flex items-center gap-1', className)}>
      {pinned.map((workflow) => {
        const Icon = getIcon(workflow.icon ?? 'Play');
        return (
          <Button
            key={workflow.id}
            variant="outline"
            size="sm"
            title={workflow.name}
            disabled={runMutation.isPending}
            onClick={() => runMutation.mutate(workflow.id)}
          >
            <Icon className="size-4" />
            {workflow.name}
          </Button>
        );
      })}
      {unpinned.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
            <Play className="size-4" /> Run workflow
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {unpinned.map((workflow) => (
              <DropdownMenuItem
                key={workflow.id}
                disabled={runMutation.isPending}
                onClick={() => runMutation.mutate(workflow.id)}
              >
                {workflow.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <Dialog open={!!formPopup} onOpenChange={(o) => !o && setFormPopup(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{pendingForm?.title ?? 'Input needed'}</DialogTitle>
          </DialogHeader>
          {pendingForm ? (
            <form
              className="flex flex-col gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                submitFormMutation.mutate();
              }}
            >
              <FormFields fields={pendingForm.fields} values={formValues} onChange={setFormValues} />
              {submitFormMutation.isError && (
                <p className="text-sm text-destructive">Something went wrong. Try again.</p>
              )}
              <Button type="submit" size="sm" disabled={submitFormMutation.isPending}>
                Submit
              </Button>
            </form>
          ) : (
            <Skeleton className="h-24 w-full" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
