import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import type { Node } from '@xyflow/react';
import { TRIGGER_STEP_ID, WorkflowActionType, type WorkflowRunStepInfo } from '@saasly/shared';
import { workflowApi } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { WorkflowCanvas } from '../components/WorkflowCanvas';
import { FormFields } from '../components/FormFields';
import type { StepNodeData } from '../lib/diagram';
import { humanize, runStatusVariant, formatDateTime } from '../lib/status';

const LIVE_STATUSES = new Set(['NOT_STARTED', 'ENQUEUED', 'RUNNING']);

export function WorkflowRunPage() {
  const { runId } = useParams<{ runId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<Record<string, unknown>>({});

  const { data: run, isLoading } = useQuery({
    queryKey: ['workflow-run', runId],
    queryFn: () => workflowApi.getRun(runId!),
    enabled: !!runId,
    // Poll while the run is still in flight (no SSE — simple polling).
    refetchInterval: (query) => (LIVE_STATUSES.has(query.state.data?.status ?? '') ? 1500 : false),
  });

  const stepInfos = run?.state?.stepInfos ?? {};
  const selectedInfo: WorkflowRunStepInfo | undefined = selectedId ? stepInfos[selectedId] : undefined;
  const selectedStep = run?.state?.flow.steps.find((s) => s.id === selectedId);
  const selectedName =
    selectedId === TRIGGER_STEP_ID ? run?.state?.flow.trigger?.name ?? 'Trigger' : selectedStep?.name ?? 'Step';
  const isPendingForm = selectedInfo?.status === 'PENDING' && selectedStep?.type === WorkflowActionType.FORM;

  const { data: pendingForm } = useQuery({
    queryKey: ['workflow-run-form', runId, selectedId],
    queryFn: () => workflowApi.getPendingForm(runId!, selectedId!),
    enabled: !!runId && !!selectedId && isPendingForm,
  });

  const submitForm = useMutation({
    mutationFn: () => workflowApi.submitPendingForm(runId!, selectedId!, formValues),
    onSuccess: () => {
      setFormValues({});
      void queryClient.invalidateQueries({ queryKey: ['workflow-run', runId] });
    },
  });

  if (isLoading || !run) {
    return (
      <div className="p-6">
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const decorate = (node: Node<StepNodeData>): Node<StepNodeData> => ({
    ...node,
    data: { ...node.data, runStatus: stepInfos[node.id]?.status ?? 'NOT_STARTED' },
  });

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-6 py-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon-xs" onClick={() => navigate('/workflows/runs')} aria-label="Back">
            <ArrowLeft className="size-4" />
          </Button>
          <h1 className="text-lg font-semibold">{run.workflowName}</h1>
          <Badge variant={runStatusVariant(run.status)}>{humanize(run.status)}</Badge>
        </div>
        <div className="text-xs text-muted-foreground">
          Started {formatDateTime(run.startedAt)} · Ended {formatDateTime(run.endedAt)}
        </div>
      </div>

      <div className="min-h-0 flex-1">
        <WorkflowCanvas
          trigger={run.state?.flow.trigger ?? null}
          steps={run.state?.flow.steps ?? []}
          selectedId={selectedId}
          readonly
          decorate={decorate}
          onSelect={setSelectedId}
          onAddAfter={() => {}}
        />
      </div>

      <Sheet open={!!selectedId} onOpenChange={(o) => !o && setSelectedId(null)}>
        <SheetContent className="flex w-[440px] flex-col gap-0 overflow-y-auto p-0 sm:max-w-[440px]">
          <SheetHeader className="border-b">
            <SheetTitle className="flex items-center gap-2">
              {selectedName}
              {selectedInfo && (
                <Badge variant={runStatusVariant(selectedInfo.status as never)}>{humanize(selectedInfo.status)}</Badge>
              )}
            </SheetTitle>
          </SheetHeader>
          <Tabs defaultValue={isPendingForm ? 'submit' : 'output'} className="p-4">
            <TabsList>
              {isPendingForm && <TabsTrigger value="submit">Submit</TabsTrigger>}
              <TabsTrigger value="output">Output</TabsTrigger>
              <TabsTrigger value="node">Node</TabsTrigger>
              <TabsTrigger value="input">Input</TabsTrigger>
              <TabsTrigger value="logs">Logs</TabsTrigger>
            </TabsList>
            {isPendingForm && (
              <TabsContent value="submit">
                {pendingForm ? (
                  <form
                    className="flex flex-col gap-4"
                    onSubmit={(e) => {
                      e.preventDefault();
                      submitForm.mutate();
                    }}
                  >
                    <p className="text-sm font-medium">{pendingForm.title}</p>
                    <FormFields fields={pendingForm.fields} values={formValues} onChange={setFormValues} />
                    {submitForm.isError && (
                      <p className="text-sm text-destructive">Something went wrong. Try again.</p>
                    )}
                    {submitForm.isSuccess && (
                      <p className="text-sm text-muted-foreground">Submitted — the run is resuming.</p>
                    )}
                    <Button type="submit" size="sm" disabled={submitForm.isPending || submitForm.isSuccess}>
                      Submit
                    </Button>
                  </form>
                ) : (
                  <Skeleton className="h-32 w-full" />
                )}
              </TabsContent>
            )}
            <TabsContent value="output">
              <Json value={selectedInfo?.result} empty="No output" />
            </TabsContent>
            <TabsContent value="node">
              <Json
                value={selectedId === TRIGGER_STEP_ID ? run.state?.flow.trigger?.settings : selectedStep?.settings?.input}
                empty="Nothing configured"
              />
            </TabsContent>
            <TabsContent value="input">
              <Json value={selectedInfo?.input} empty="No resolved input captured for this step" />
            </TabsContent>
            <TabsContent value="logs">
              {selectedInfo?.error ? (
                <pre className="whitespace-pre-wrap rounded-md bg-destructive/10 p-3 text-xs text-destructive">
                  {selectedInfo.error}
                </pre>
              ) : (
                <div className="text-xs text-muted-foreground">
                  <p>Status: {humanize(selectedInfo?.status ?? 'NOT_STARTED')}</p>
                  {selectedInfo?.startedAt && <p>Started: {formatDateTime(selectedInfo.startedAt)}</p>}
                  {selectedInfo?.endedAt && <p>Ended: {formatDateTime(selectedInfo.endedAt)}</p>}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Json({ value, empty }: { value: unknown; empty: string }) {
  if (value === undefined || value === null || (typeof value === 'object' && Object.keys(value).length === 0)) {
    return <p className="text-xs text-muted-foreground">{empty}</p>;
  }
  return (
    <pre className="max-h-[60vh] overflow-auto rounded-md bg-muted p-3 text-xs">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}
