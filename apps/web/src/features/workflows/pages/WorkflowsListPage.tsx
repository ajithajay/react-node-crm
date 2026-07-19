import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Workflow as WorkflowIcon } from 'lucide-react';
import { workflowApi } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ListToolbar } from '../components/ListToolbar';
import { humanize, workflowStatusVariant, formatDateTime } from '../lib/status';

type SortKey = 'updated' | 'name';

export function WorkflowsListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sort, setSort] = useState<SortKey>('updated');

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

  const filtered = useMemo(() => {
    if (!workflows) return [];
    const term = search.trim().toLowerCase();
    return workflows
      .filter((w) => (term ? w.name.toLowerCase().includes(term) : true))
      .filter((w) => {
        if (statusFilter === 'ALL') return true;
        if (statusFilter === 'DRAFT') return w.statuses.length === 0 || w.statuses.includes('DRAFT');
        return w.statuses.includes(statusFilter as 'ACTIVE' | 'DEACTIVATED');
      })
      .sort((a, b) =>
        sort === 'name'
          ? a.name.localeCompare(b.name)
          : new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );
  }, [workflows, search, statusFilter, sort]);

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

      <ListToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search workflows…"
        filterValue={statusFilter}
        onFilterChange={setStatusFilter}
        filterOptions={[
          { value: 'ALL', label: 'All statuses' },
          { value: 'DRAFT', label: 'Draft' },
          { value: 'ACTIVE', label: 'Active' },
          { value: 'DEACTIVATED', label: 'Deactivated' },
        ]}
        sortValue={sort}
        onSortChange={(v) => setSort(v as SortKey)}
        sortOptions={[
          { value: 'updated', label: 'Last updated' },
          { value: 'name', label: 'Name' },
        ]}
      />

      {isLoading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      )}

      {workflows && workflows.length === 0 && (
        <p className="text-sm text-muted-foreground">No workflows yet — create one to get started.</p>
      )}

      {workflows && workflows.length > 0 && filtered.length === 0 && (
        <p className="text-sm text-muted-foreground">No workflows match your search/filter.</p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((workflow) => (
          <Card
            key={workflow.id}
            className="group flex cursor-pointer flex-col gap-2 p-4 hover:bg-accent"
            onClick={() => navigate(`/workflows/${workflow.id}`)}
          >
            <div className="flex items-center justify-between">
              <WorkflowIcon className="size-5 text-muted-foreground" />
              <Button
                variant="ghost"
                size="icon-xs"
                className="opacity-0 group-hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteMutation.mutate(workflow.id);
                }}
                aria-label="Delete workflow"
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
            <div className="font-medium">{workflow.name}</div>
            <div className="flex flex-wrap gap-1">
              {workflow.statuses.length === 0 ? (
                <Badge variant="secondary">Draft</Badge>
              ) : (
                workflow.statuses.map((status) => (
                  <Badge key={status} variant={workflowStatusVariant(status)}>
                    {humanize(status)}
                  </Badge>
                ))
              )}
            </div>
            <div className="text-xs text-muted-foreground">Updated {formatDateTime(workflow.updatedAt)}</div>
          </Card>
        ))}
      </div>
    </div>
  );
}
