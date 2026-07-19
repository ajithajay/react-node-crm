import type {
  WorkflowStatus,
  WorkflowVersionStatus,
  WorkflowRunStatus,
} from '@saasly/shared';

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline' | 'ghost';

export function workflowStatusVariant(status: WorkflowStatus): BadgeVariant {
  switch (status) {
    case 'ACTIVE':
      return 'default';
    case 'DRAFT':
      return 'secondary';
    case 'DEACTIVATED':
      return 'outline';
    default:
      return 'outline';
  }
}

export function versionStatusVariant(status: WorkflowVersionStatus): BadgeVariant {
  switch (status) {
    case 'ACTIVE':
      return 'default';
    case 'DRAFT':
      return 'secondary';
    case 'ARCHIVED':
    case 'DEACTIVATED':
      return 'outline';
    default:
      return 'outline';
  }
}

export function runStatusVariant(status: WorkflowRunStatus): BadgeVariant {
  switch (status) {
    case 'COMPLETED':
      return 'default';
    case 'RUNNING':
    case 'ENQUEUED':
    case 'NOT_STARTED':
      return 'secondary';
    case 'FAILED':
      return 'destructive';
    case 'STOPPED':
      return 'outline';
    default:
      return 'outline';
  }
}

export function humanize(status: string): string {
  return status
    .toLowerCase()
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}
