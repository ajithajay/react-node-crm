import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { workflowApi } from '@/lib/api-client';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { humanize, runStatusVariant, formatDateTime } from '../lib/status';

export function WorkflowRunsListPage() {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ['workflow-runs'],
    queryFn: () => workflowApi.listRuns({ pageSize: 100 }),
  });

  return (
    <div className="flex flex-col gap-6 p-6">
      <h1 className="text-2xl font-semibold">Workflow runs</h1>

      {isLoading && <Skeleton className="h-40 w-full" />}

      {data && data.items.length === 0 && (
        <p className="text-sm text-muted-foreground">No runs yet — trigger a workflow to see its run history here.</p>
      )}

      {data && data.items.length > 0 && (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Workflow</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Started</TableHead>
                <TableHead>Ended</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((run) => (
                <TableRow
                  key={run.id}
                  className="cursor-pointer"
                  onClick={() => navigate(`/workflows/runs/${run.id}`)}
                >
                  <TableCell className="font-medium">{run.workflowName}</TableCell>
                  <TableCell>
                    <Badge variant={runStatusVariant(run.status)}>{humanize(run.status)}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatDateTime(run.startedAt)}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDateTime(run.endedAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
