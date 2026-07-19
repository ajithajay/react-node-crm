import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Copy, GitBranch, History, Loader2, Play, Power, Trash2 } from 'lucide-react';
import {
  TRIGGER_STEP_ID,
  WorkflowActionType,
  WorkflowTriggerType,
} from '@saasly/shared';
import { workflowApi } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useWorkflowEditor } from '../hooks/use-workflow-editor';
import { WorkflowCanvas } from '../components/WorkflowCanvas';
import { StepSelectPanel } from '../components/StepSelectPanel';
import { StepConfigDrawer } from '../components/StepConfigDrawer';
import { humanize, workflowStatusVariant } from '../lib/status';

export function WorkflowBuilderPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const editor = useWorkflowEditor(id!);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [triggerPickerOpen, setTriggerPickerOpen] = useState(false);
  const [actionPicker, setActionPicker] = useState<{ open: boolean; parentId: string; branch?: string }>({
    open: false,
    parentId: '',
  });
  const [branchChooser, setBranchChooser] = useState<{ open: boolean; parentId: string }>({
    open: false,
    parentId: '',
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['workflow', id] });
    void queryClient.invalidateQueries({ queryKey: ['workflows'] });
  };
  const activateMutation = useMutation({ mutationFn: () => workflowApi.activate(id!), onSuccess: invalidate });
  const deactivateMutation = useMutation({ mutationFn: () => workflowApi.deactivate(id!), onSuccess: invalidate });
  const newVersionMutation = useMutation({ mutationFn: () => editor.createDraft() });
  const discardDraftMutation = useMutation({ mutationFn: () => editor.discardDraft() });
  const duplicateMutation = useMutation({
    mutationFn: () => workflowApi.duplicate(id!),
    onSuccess: (copy) => navigate(`/workflows/${copy.id}`),
  });
  const runMutation = useMutation({
    mutationFn: () => workflowApi.run(id!),
    onSuccess: (run) => navigate(`/workflows/runs/${run.id}`),
  });

  if (editor.isLoading || !editor.workflow) {
    return (
      <div className="p-6">
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const workflow = editor.workflow;
  const hasActiveVersion = workflow.statuses.includes('ACTIVE');
  const hasDraftVersion = workflow.statuses.includes('DRAFT');
  const canDiscardDraft = hasDraftVersion && workflow.versions.length > 1;

  const handleSelect = (nodeId: string) => {
    if (nodeId === TRIGGER_STEP_ID && !editor.trigger) {
      if (editor.isEditable) setTriggerPickerOpen(true);
      return;
    }
    setSelectedId(nodeId);
  };

  const handleAddAfter = (nodeId: string) => {
    const parent = editor.steps.find((s) => s.id === nodeId);
    if (parent?.type === WorkflowActionType.IF_ELSE) {
      setBranchChooser({ open: true, parentId: nodeId });
      return;
    }
    const branch = parent?.type === WorkflowActionType.ITERATOR ? 'loop' : undefined;
    setActionPicker({ open: true, parentId: nodeId, branch });
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-6 py-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon-xs" onClick={() => navigate('/workflows')} aria-label="Back">
            <ArrowLeft className="size-4" />
          </Button>
          <h1 className="text-lg font-semibold">{workflow.name}</h1>
          <span className="flex gap-1">
            {workflow.statuses.map((status) => (
              <Badge key={status} variant={workflowStatusVariant(status)}>
                {humanize(status)}
              </Badge>
            ))}
          </span>
          {editor.saving && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Loader2 className="size-3 animate-spin" /> Saving…
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate(`/workflows/${id}/versions`)}>
            <History className="size-4" /> Versions
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate(`/workflows/runs?workflowId=${id}`)}>
            <GitBranch className="size-4" /> See Runs
          </Button>
          <Button variant="outline" size="sm" onClick={() => duplicateMutation.mutate()}>
            <Copy className="size-4" /> Duplicate
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!editor.trigger || runMutation.isPending}
            onClick={() => runMutation.mutate()}
          >
            <Play className="size-4" /> Run
          </Button>

          {hasDraftVersion && (
            <>
              {canDiscardDraft && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive"
                  disabled={discardDraftMutation.isPending}
                  onClick={() => discardDraftMutation.mutate()}
                >
                  <Trash2 className="size-4" /> Discard Draft
                </Button>
              )}
              <Button size="sm" onClick={() => activateMutation.mutate()}>
                <Play className="size-4" /> Activate
              </Button>
            </>
          )}

          {!hasDraftVersion && hasActiveVersion && (
            <>
              <Button variant="outline" size="sm" onClick={() => deactivateMutation.mutate()}>
                <Power className="size-4" /> Deactivate
              </Button>
              <Button size="sm" onClick={() => newVersionMutation.mutate()} disabled={newVersionMutation.isPending}>
                New Version
              </Button>
            </>
          )}

          {!hasDraftVersion && !hasActiveVersion && (
            <Button size="sm" onClick={() => newVersionMutation.mutate()} disabled={newVersionMutation.isPending}>
              New Version
            </Button>
          )}
        </div>
      </div>

      {(activateMutation.isError || deactivateMutation.isError || newVersionMutation.isError || discardDraftMutation.isError) && (
        <p className="px-6 pt-3 text-sm text-destructive">
          {(activateMutation.error as Error)?.message ??
            (deactivateMutation.error as Error)?.message ??
            (newVersionMutation.error as Error)?.message ??
            (discardDraftMutation.error as Error)?.message}
        </p>
      )}

      <div className="min-h-0 flex-1">
        <WorkflowCanvas
          trigger={editor.trigger}
          steps={editor.steps}
          selectedId={selectedId}
          readonly={!editor.isEditable}
          onSelect={handleSelect}
          onAddAfter={handleAddAfter}
        />
      </div>

      <StepSelectPanel
        open={triggerPickerOpen}
        mode="trigger"
        onOpenChange={setTriggerPickerOpen}
        onPickTrigger={(type: WorkflowTriggerType) => {
          editor.setTriggerType(type);
          setTriggerPickerOpen(false);
          setSelectedId(TRIGGER_STEP_ID);
        }}
        onPickAction={() => {}}
      />

      <StepSelectPanel
        open={actionPicker.open}
        mode="action"
        onOpenChange={(o) => setActionPicker((s) => ({ ...s, open: o }))}
        onPickTrigger={() => {}}
        onPickAction={(type: WorkflowActionType) => {
          const newId = editor.addStepAfter(actionPicker.parentId, type, actionPicker.branch);
          setActionPicker({ open: false, parentId: '' });
          setSelectedId(newId);
        }}
      />

      <Dialog open={branchChooser.open} onOpenChange={(o) => setBranchChooser((s) => ({ ...s, open: o }))}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>Add to which branch?</DialogTitle>
          </DialogHeader>
          <div className="flex gap-2">
            {(['true', 'false'] as const).map((branch) => (
              <Button
                key={branch}
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setActionPicker({ open: true, parentId: branchChooser.parentId, branch });
                  setBranchChooser({ open: false, parentId: '' });
                }}
              >
                {branch === 'true' ? 'True' : 'False'}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <StepConfigDrawer
        selectedId={selectedId}
        trigger={editor.trigger}
        steps={editor.steps}
        workflowId={id!}
        readOnly={!editor.isEditable}
        onClose={() => setSelectedId(null)}
        onUpdateTrigger={editor.updateTrigger}
        onChangeTrigger={() => {
          setSelectedId(null);
          setTriggerPickerOpen(true);
        }}
        onDeleteTrigger={() => {
          editor.deleteTrigger();
          setSelectedId(null);
        }}
        onUpdateStep={editor.updateStep}
        onDeleteStep={(stepId) => {
          editor.deleteStep(stepId);
          setSelectedId(null);
        }}
      />
    </div>
  );
}
