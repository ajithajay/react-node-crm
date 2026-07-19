import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { GitBranch, X } from 'lucide-react';
import { workflowApi } from '@/lib/api-client';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ListToolbar } from '../components/ListToolbar';
import { humanize, runStatusVariant, formatDateTime } from '../lib/status';

type SortKey = 'started' | 'ended';

export function WorkflowRunsListPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const workflowId = searchParams.get('workflowId') ?? undefined;
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sort, setSort] = useState<SortKey>('started');

  const { data, isLoading } = useQuery({
    queryKey: ['workflow-runs', workflowId, statusFilter],
    queryFn: () =>
      workflowApi.listRuns({
        workflowId,
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        pageSize: 100,
      }),
  });

  const clearWorkflowFilter = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('workflowId');
    setSearchParams(next);
  };

  const filtered = useMemo(() => {
    if (!data) return [];
    const term = search.trim().toLowerCase();
    return data.items
      .filter((run) => (term ? run.workflowName.toLowerCase().includes(term) : true))
      .sort((a, b) => {
        const field = sort === 'started' ? 'startedAt' : 'endedAt';
        const av = a[field] ? new Date(a[field]!).getTime() : 0;
        const bv = b[field] ? new Date(b[field]!).getTime() : 0;
        return bv - av;
      });
  }, [data, search, sort]);

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-semibold">Workflow runs</h1>
        {workflowId && (
          <Badge variant="secondary" className="flex items-center gap-1">
            Filtered by workflow
            <button type="button" onClick={clearWorkflowFilter} aria-label="Clear workflow filter">
              <X className="size-3" />
            </button>
          </Badge>
        )}
      </div>

      <ListToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by workflow name…"
        filterValue={statusFilter}
        onFilterChange={setStatusFilter}
        filterOptions={[
          { value: 'ALL', label: 'All statuses' },
          { value: 'NOT_STARTED', label: 'Not started' },
          { value: 'ENQUEUED', label: 'Enqueued' },
          { value: 'RUNNING', label: 'Running' },
          { value: 'COMPLETED', label: 'Completed' },
          { value: 'FAILED', label: 'Failed' },
          { value: 'STOPPED', label: 'Stopped' },
        ]}
        sortValue={sort}
        onSortChange={(v) => setSort(v as SortKey)}
        sortOptions={[
          { value: 'started', label: 'Started' },
          { value: 'ended', label: 'Ended' },
        ]}
      />

      {isLoading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      )}

      {data && data.items.length === 0 && (
        <p className="text-sm text-muted-foreground">No runs yet — trigger a workflow to see its run history here.</p>
      )}

      {data && data.items.length > 0 && filtered.length === 0 && (
        <p className="text-sm text-muted-foreground">No runs match your search/filter.</p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((run) => (
          <Card
            key={run.id}
            className="flex cursor-pointer flex-col gap-2 p-4 hover:bg-accent"
            onClick={() => navigate(`/workflows/runs/${run.id}`)}
          >
            <div className="flex items-center justify-between">
              <GitBranch className="size-5 text-muted-foreground" />
              <Badge variant={runStatusVariant(run.status)}>{humanize(run.status)}</Badge>
            </div>
            <div className="font-medium">{run.workflowName}</div>
            <div className="flex flex-col text-xs text-muted-foreground">
              <span>Started {formatDateTime(run.startedAt)}</span>
              <span>Ended {formatDateTime(run.endedAt)}</span>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
