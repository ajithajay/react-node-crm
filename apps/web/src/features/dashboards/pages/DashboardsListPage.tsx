import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LayoutDashboard, Plus, Trash2 } from 'lucide-react';
import { dashboardApi } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

export function DashboardsListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState('');

  const { data: dashboards, isLoading } = useQuery({ queryKey: ['dashboards'], queryFn: dashboardApi.list });

  const createMutation = useMutation({
    mutationFn: (t: string) => dashboardApi.create(t),
    onSuccess: (dashboard) => {
      void queryClient.invalidateQueries({ queryKey: ['dashboards'] });
      navigate(`/dashboards/${dashboard.id}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => dashboardApi.remove(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['dashboards'] }),
  });

  function handleCreate(): void {
    if (!title.trim()) return;
    createMutation.mutate(title.trim());
    setTitle('');
    setCreateOpen(false);
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Dashboards</h1>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            New dashboard
          </Button>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>New dashboard</DialogTitle>
            </DialogHeader>
            <Input
              autoFocus
              placeholder="Dashboard title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
            <DialogFooter>
              <Button onClick={handleCreate}>Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      )}

      {dashboards && dashboards.length === 0 && (
        <p className="text-sm text-muted-foreground">No dashboards yet — create one to get started.</p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {dashboards?.map((dashboard) => (
          <Card
            key={dashboard.id}
            className="group flex cursor-pointer flex-col gap-2 p-4 hover:bg-accent"
            onClick={() => navigate(`/dashboards/${dashboard.id}`)}
          >
            <div className="flex items-center justify-between">
              <LayoutDashboard className="size-5 text-muted-foreground" />
              <Button
                variant="ghost"
                size="icon-xs"
                className="opacity-0 group-hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteMutation.mutate(dashboard.id);
                }}
                aria-label="Delete dashboard"
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
            <div className="font-medium">{dashboard.title}</div>
          </Card>
        ))}
      </div>
    </div>
  );
}
