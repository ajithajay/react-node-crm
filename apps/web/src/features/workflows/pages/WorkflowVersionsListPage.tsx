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
import { humanize, workflowStatusVariant, formatDateTime } from '../lib/status';

// Versions live inside a workflow; this overview lists each workflow with its aggregate version
// statuses and links into the builder (where the per-version history is shown).
export function WorkflowVersionsListPage() {
  const navigate = useNavigate();
  const { data: workflows, isLoading } = useQuery({
    queryKey: ['workflows'],
    queryFn: workflowApi.list,
  });

  return (
    <div className="flex flex-col gap-6 p-6">
      <h1 className="text-2xl font-semibold">Workflow versions</h1>

      {isLoading && <Skeleton className="h-40 w-full" />}

      {workflows && workflows.length === 0 && (
        <p className="text-sm text-muted-foreground">No workflows yet.</p>
      )}

      {workflows && workflows.length > 0 && (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Workflow</TableHead>
                <TableHead>Statuses</TableHead>
                <TableHead>Published version</TableHead>
                <TableHead>Last updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {workflows.map((workflow) => (
                <TableRow
                  key={workflow.id}
                  className="cursor-pointer"
                  onClick={() => navigate(`/workflows/${workflow.id}`)}
                >
                  <TableCell className="font-medium">{workflow.name}</TableCell>
                  <TableCell>
                    <span className="flex flex-wrap gap-1">
                      {workflow.statuses.map((status) => (
                        <Badge key={status} variant={workflowStatusVariant(status)}>
                          {humanize(status)}
                        </Badge>
                      ))}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {workflow.lastPublishedVersionId ? 'Published' : 'Not published'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatDateTime(workflow.updatedAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
