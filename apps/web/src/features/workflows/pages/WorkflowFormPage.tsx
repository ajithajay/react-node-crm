import { useState } from 'react';
import { useParams } from 'react-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { getApiBaseUrl } from '@/lib/host';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { FormFields, type FormFieldDef } from '../components/FormFields';

interface FormDef {
  workflowName: string;
  status: string;
  title: string;
  fields: FormFieldDef[];
}

/**
 * Public form page for a paused FORM step — reached via a link the workflow surfaces. No auth: the
 * workspaceId/runId/stepId in the URL scope it. Submitting resumes the run.
 */
export function WorkflowFormPage() {
  const { workspaceId, runId, stepId } = useParams<{ workspaceId: string; runId: string; stepId: string }>();
  const base = `${getApiBaseUrl()}/triggers/form/${workspaceId}/${runId}/${stepId}`;
  const [values, setValues] = useState<Record<string, unknown>>({});

  const { data: form, isLoading } = useQuery({
    queryKey: ['workflow-form', workspaceId, runId, stepId],
    queryFn: () => fetch(base).then((r) => r.json() as Promise<FormDef>),
  });

  const submit = useMutation({
    mutationFn: () =>
      fetch(base, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ values }),
      }).then((r) => {
        if (!r.ok) throw new Error('Submission failed');
        return r.json();
      }),
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md p-6">
        {isLoading && <Skeleton className="h-40 w-full" />}
        {form && form.status !== 'PENDING' && !submit.isSuccess && (
          <p className="text-sm text-muted-foreground">This form is no longer awaiting input.</p>
        )}
        {submit.isSuccess ? (
          <div className="text-center">
            <p className="text-lg font-semibold">Thank you</p>
            <p className="text-sm text-muted-foreground">Your response has been recorded.</p>
          </div>
        ) : (
          form &&
          form.status === 'PENDING' && (
            <form
              className="flex flex-col gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                submit.mutate();
              }}
            >
              <h1 className="text-lg font-semibold">{form.title}</h1>
              <FormFields fields={form.fields} values={values} onChange={setValues} />
              {submit.isError && <p className="text-sm text-destructive">Something went wrong. Try again.</p>}
              <Button type="submit" disabled={submit.isPending}>
                Submit
              </Button>
            </form>
          )
        )}
      </Card>
    </div>
  );
}
