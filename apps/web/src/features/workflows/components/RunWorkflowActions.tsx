import { useNavigate } from 'react-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Play } from 'lucide-react';
import type { ManualTriggerAvailability } from '@saasly/shared';
import { workflowApi } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { getIcon } from '@/lib/icons';
import { cn } from '@/lib/utils';

interface Props {
  availability: ManualTriggerAvailability;
  objectNameSingular?: string;
  buildPayload: () => Record<string, unknown>;
  onRun?: () => void;
  className?: string;
}

/**
 * Renders the MANUAL-trigger workflows runnable on a given surface: pinned ones as always-visible
 * one-click icon buttons, unpinned ones tucked into a "Run workflow" dropdown — mirrors twenty's
 * pinned/unpinned split without needing its right-click-menu/edit-mode machinery.
 */
export function RunWorkflowActions({ availability, objectNameSingular, buildPayload, onRun, className }: Props) {
  const navigate = useNavigate();
  const { data: workflows } = useQuery({
    queryKey: ['workflows-runnable', availability, objectNameSingular],
    queryFn: () => workflowApi.listRunnable(availability, objectNameSingular),
    enabled: availability === 'GLOBAL' || !!objectNameSingular,
  });

  const runMutation = useMutation({
    mutationFn: (workflowId: string) => workflowApi.run(workflowId, buildPayload()),
    onSuccess: (run) => {
      onRun?.();
      navigate(`/workflows/runs/${run.id}`);
    },
  });

  if (!workflows?.length) return null;
  const pinned = workflows.filter((w) => w.isPinned);
  const unpinned = workflows.filter((w) => !w.isPinned);

  return (
    <div className={cn('flex items-center gap-1', className)}>
      {pinned.map((workflow) => {
        const Icon = getIcon(workflow.icon ?? 'Play');
        return (
          <Button
            key={workflow.id}
            variant="outline"
            size="sm"
            title={workflow.name}
            disabled={runMutation.isPending}
            onClick={() => runMutation.mutate(workflow.id)}
          >
            <Icon className="size-4" />
            {workflow.name}
          </Button>
        );
      })}
      {unpinned.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
            <Play className="size-4" /> Run workflow
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {unpinned.map((workflow) => (
              <DropdownMenuItem
                key={workflow.id}
                disabled={runMutation.isPending}
                onClick={() => runMutation.mutate(workflow.id)}
              >
                {workflow.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
