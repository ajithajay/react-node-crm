import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, GitCommitHorizontal } from 'lucide-react';
import { workflowApi } from '@/lib/api-client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ListToolbar } from '../components/ListToolbar';
import { humanize, versionStatusVariant, formatDateTime } from '../lib/status';

type SortKey = 'updated' | 'name';

/** Lists a single workflow's WorkflowVersion history (v1, v2, …) — reached from its builder page. */
export function WorkflowVersionsListPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sort, setSort] = useState<SortKey>('updated');

  const { data: workflow } = useQuery({
    queryKey: ['workflow', id],
    queryFn: () => workflowApi.get(id!),
    enabled: !!id,
  });

  const { data: versions, isLoading } = useQuery({
    queryKey: ['workflow-versions', id],
    queryFn: () => workflowApi.listVersions(id!),
    enabled: !!id,
  });

  const filtered = useMemo(() => {
    if (!versions) return [];
    const term = search.trim().toLowerCase();
    return versions
      .filter((v) => (term ? v.name.toLowerCase().includes(term) : true))
      .filter((v) => statusFilter === 'ALL' || v.status === statusFilter)
      .sort((a, b) =>
        sort === 'name'
          ? a.name.localeCompare(b.name)
          : new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );
  }, [versions, search, statusFilter, sort]);

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon-xs" onClick={() => navigate(`/workflows/${id}`)} aria-label="Back">
          <ArrowLeft className="size-4" />
        </Button>
        <h1 className="text-2xl font-semibold">
          {workflow ? `${workflow.name} — Versions` : 'Workflow versions'}
        </h1>
      </div>

      <ListToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search versions…"
        filterValue={statusFilter}
        onFilterChange={setStatusFilter}
        filterOptions={[
          { value: 'ALL', label: 'All statuses' },
          { value: 'DRAFT', label: 'Draft' },
          { value: 'ACTIVE', label: 'Active' },
          { value: 'DEACTIVATED', label: 'Deactivated' },
          { value: 'ARCHIVED', label: 'Archived' },
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

      {versions && versions.length === 0 && (
        <p className="text-sm text-muted-foreground">No versions yet.</p>
      )}

      {versions && versions.length > 0 && filtered.length === 0 && (
        <p className="text-sm text-muted-foreground">No versions match your search/filter.</p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((version) => (
          <Card key={version.id} className="flex flex-col gap-2 p-4">
            <div className="flex items-center justify-between">
              <GitCommitHorizontal className="size-5 text-muted-foreground" />
              <Badge variant={versionStatusVariant(version.status)}>{humanize(version.status)}</Badge>
            </div>
            <div className="font-medium">{version.name}</div>
            <div className="flex flex-col text-xs text-muted-foreground">
              <span>Created {formatDateTime(version.createdAt)}</span>
              <span>Updated {formatDateTime(version.updatedAt)}</span>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
