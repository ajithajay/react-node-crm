import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Workflow as WorkflowIcon } from 'lucide-react';
import { workflowApi } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
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

export function WorkflowsListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');

  const { data: workflows, isLoading } = useQuery({ queryKey: ['workflows'], queryFn: workflowApi.list });

  const createMutation = useMutation({
    mutationFn: (n: string) => workflowApi.create(n),
    onSuccess: (workflow) => {
      void queryClient.invalidateQueries({ queryKey: ['workflows'] });
      navigate(`/workflows/${workflow.id}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => workflowApi.remove(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['workflows'] }),
  });

  function handleCreate(): void {
    if (!name.trim()) return;
    createMutation.mutate(name.trim());
    setName('');
    setCreateOpen(false);
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Workflows</h1>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            New workflow
          </Button>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>New workflow</DialogTitle>
            </DialogHeader>
            <Input
              autoFocus
              placeholder="Workflow name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
            <DialogFooter>
              <Button onClick={handleCreate}>Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading && <Skeleton className="h-40 w-full" />}

      {workflows && workflows.length === 0 && (
        <p className="text-sm text-muted-foreground">No workflows yet — create one to get started.</p>
      )}

      {workflows && workflows.length > 0 && (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last updated</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {workflows.map((workflow) => (
                <TableRow
                  key={workflow.id}
                  className="cursor-pointer"
                  onClick={() => navigate(`/workflows/${workflow.id}`)}
                >
                  <TableCell className="font-medium">
                    <span className="flex items-center gap-2">
                      <WorkflowIcon className="size-4 text-muted-foreground" />
                      {workflow.name}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="flex flex-wrap gap-1">
                      {workflow.statuses.length === 0 ? (
                        <Badge variant="outline">Draft</Badge>
                      ) : (
                        workflow.statuses.map((status) => (
                          <Badge key={status} variant={workflowStatusVariant(status)}>
                            {humanize(status)}
                          </Badge>
                        ))
                      )}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatDateTime(workflow.updatedAt)}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteMutation.mutate(workflow.id);
                      }}
                      aria-label="Delete workflow"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
