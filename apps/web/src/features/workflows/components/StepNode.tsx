import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Plus } from 'lucide-react';
import { getIcon } from '@/lib/icons';
import { cn } from '@/lib/utils';
import { useWorkflowCanvas } from './canvas-context';
import type { StepNodeData } from '../lib/diagram';

const RUN_STATUS_COLOR: Record<string, string> = {
  SUCCESS: 'bg-green-500',
  RUNNING: 'bg-blue-500 animate-pulse',
  FAILED: 'bg-red-500',
  FAILED_SAFELY: 'bg-amber-500',
  PENDING: 'bg-blue-400 animate-pulse',
  SKIPPED: 'bg-muted-foreground/40',
  NOT_STARTED: 'bg-muted-foreground/20',
  STOPPED: 'bg-muted-foreground/40',
};

export function StepNode({ id, data }: NodeProps) {
  const { selectedId, onSelect, onAddAfter, readonly } = useWorkflowCanvas();
  const node = data as StepNodeData;
  const Icon = getIcon(node.icon);
  const isTrigger = node.kind === 'trigger' || node.kind === 'empty-trigger';
  const isEmpty = node.kind === 'empty-trigger';
  const selected = selectedId === id;

  return (
    <div className="relative">
      {!isTrigger && <Handle type="target" position={Position.Top} className="!bg-muted-foreground" />}

      <button
        type="button"
        onClick={() => onSelect(id)}
        className={cn(
          'flex w-[240px] items-center gap-3 rounded-lg border bg-card px-3 py-2.5 text-left shadow-sm transition hover:border-primary/60',
          selected && 'border-primary ring-2 ring-primary/30',
          isEmpty && 'border-dashed text-muted-foreground',
        )}
      >
        <span
          className={cn(
            'flex size-8 shrink-0 items-center justify-center rounded-md',
            isTrigger ? 'bg-primary/10 text-primary' : 'bg-muted text-foreground',
          )}
        >
          <Icon className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {node.typeLabel}
          </span>
          <span className="block truncate text-sm font-medium">{node.label}</span>
        </span>
        {node.runStatus ? (
          <span
            className={cn('size-2.5 shrink-0 rounded-full', RUN_STATUS_COLOR[node.runStatus] ?? 'bg-muted')}
            title={node.runStatus}
          />
        ) : (
          !node.valid && !isEmpty && (
            <span className="size-2 shrink-0 rounded-full bg-amber-500" title="Not configured" />
          )
        )}
      </button>

      <Handle type="source" position={Position.Bottom} className="!bg-muted-foreground" />

      {!readonly && !isEmpty && (
        <button
          type="button"
          onClick={() => onAddAfter(id)}
          className="absolute -bottom-9 left-1/2 flex size-6 -translate-x-1/2 items-center justify-center rounded-full border bg-background text-muted-foreground shadow-sm transition hover:border-primary hover:text-primary"
          aria-label="Add step"
        >
          <Plus className="size-3.5" />
        </button>
      )}
    </div>
  );
}
