import { TRIGGER_STEP_ID, WorkflowActionType, type WorkflowStep, type WorkflowTrigger } from '@saasly/shared';
import { RefreshCw, Trash2 } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { actionEntry, triggerEntry } from '../lib/step-catalog';
import { TriggerForm } from './steps/TriggerForms';
import { ActionForm } from './steps/ActionForms';
import { Field } from './steps/fields';

interface Props {
  selectedId: string | null;
  trigger: WorkflowTrigger | null;
  steps: WorkflowStep[];
  workflowId: string;
  onClose: () => void;
  onUpdateTrigger: (trigger: WorkflowTrigger) => void;
  onChangeTrigger: () => void;
  onDeleteTrigger: () => void;
  onUpdateStep: (step: WorkflowStep) => void;
  onDeleteStep: (id: string) => void;
}

// Control-flow steps have no external side effect to retry/continue past — no error-handling UI.
const NO_ERROR_HANDLING: ReadonlySet<string> = new Set([
  WorkflowActionType.FILTER,
  WorkflowActionType.IF_ELSE,
  WorkflowActionType.ITERATOR,
]);

export function StepConfigDrawer({
  selectedId,
  trigger,
  steps,
  workflowId,
  onClose,
  onUpdateTrigger,
  onChangeTrigger,
  onDeleteTrigger,
  onUpdateStep,
  onDeleteStep,
}: Props) {
  const isTrigger = selectedId === TRIGGER_STEP_ID;
  const step = isTrigger ? null : steps.find((s) => s.id === selectedId) ?? null;
  const open = !!selectedId && (isTrigger ? !!trigger : !!step);
  const title = isTrigger
    ? triggerEntry(trigger?.type ?? '')?.label ?? 'Trigger'
    : actionEntry(step?.type ?? '')?.label ?? 'Action';

  const errorOptions = step?.settings?.errorHandlingOptions ?? {
    retryOnFailure: { value: false },
    continueOnFailure: { value: false },
  };
  const setErrorOption = (key: 'retryOnFailure' | 'continueOnFailure', value: boolean) => {
    if (!step) return;
    onUpdateStep({
      ...step,
      settings: { ...step.settings, errorHandlingOptions: { ...errorOptions, [key]: { value } } },
    });
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="flex w-[420px] flex-col gap-0 overflow-y-auto p-0 sm:max-w-[420px]">
        <SheetHeader className="border-b">
          <SheetTitle>{title}</SheetTitle>
        </SheetHeader>

        <div className="flex flex-col gap-4 p-4">
          {isTrigger && trigger && (
            <>
              <Field label="Name">
                <Input value={trigger.name} onChange={(e) => onUpdateTrigger({ ...trigger, name: e.target.value })} />
              </Field>
              <Separator />
              <TriggerForm trigger={trigger} workflowId={workflowId} onChange={onUpdateTrigger} />
              <Separator />
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={onChangeTrigger}>
                  <RefreshCw className="size-4" /> Change trigger
                </Button>
                <Button variant="ghost" size="sm" className="text-destructive" onClick={onDeleteTrigger}>
                  <Trash2 className="size-4" /> Delete trigger
                </Button>
              </div>
            </>
          )}

          {step && (
            <>
              <Field label="Name">
                <Input value={step.name} onChange={(e) => onUpdateStep({ ...step, name: e.target.value })} />
              </Field>
              <Separator />
              <ActionForm step={step} steps={steps} trigger={trigger} onChange={onUpdateStep} />

              {!NO_ERROR_HANDLING.has(step.type) && (
                <>
                  <Separator />
                  <div className="flex flex-col gap-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Error handling
                    </div>
                    <label className="flex items-center justify-between">
                      <span className="text-sm">Continue on failure</span>
                      <Switch
                        checked={errorOptions.continueOnFailure?.value ?? false}
                        onCheckedChange={(v) => setErrorOption('continueOnFailure', v)}
                      />
                    </label>
                    <label className="flex items-center justify-between">
                      <span className="text-sm">Retry on failure</span>
                      <Switch
                        checked={errorOptions.retryOnFailure?.value ?? false}
                        onCheckedChange={(v) => setErrorOption('retryOnFailure', v)}
                      />
                    </label>
                  </div>
                </>
              )}

              <Separator />
              <Button variant="ghost" className="self-start text-destructive" onClick={() => step && onDeleteStep(step.id)}>
                <Trash2 className="size-4" /> Delete step
              </Button>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
