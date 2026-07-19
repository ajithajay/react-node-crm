import { WorkflowActionType, WorkflowTriggerType } from '@saasly/shared';
import { getIcon } from '@/lib/icons';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  ACTION_CATALOG,
  ACTION_GROUPS,
  TRIGGER_CATALOG,
  type ActionGroup,
} from '../lib/step-catalog';

interface Props {
  open: boolean;
  mode: 'trigger' | 'action';
  onOpenChange: (open: boolean) => void;
  onPickTrigger: (type: WorkflowTriggerType) => void;
  onPickAction: (type: WorkflowActionType) => void;
}

function Row({ icon, label, description, onClick }: { icon: string; label: string; description: string; onClick: () => void }) {
  const Icon = getIcon(icon);
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-start gap-3 rounded-md border p-3 text-left transition hover:border-primary/60 hover:bg-accent"
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-foreground">
        <Icon className="size-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-xs text-muted-foreground">{description}</span>
      </span>
    </button>
  );
}

export function StepSelectPanel({ open, mode, onOpenChange, onPickTrigger, onPickAction }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === 'trigger' ? 'Select a trigger' : 'Select an action'}</DialogTitle>
        </DialogHeader>

        {mode === 'trigger' ? (
          <div className="flex flex-col gap-2">
            {TRIGGER_CATALOG.map((t) => (
              <Row
                key={t.type}
                icon={t.icon}
                label={t.label}
                description={t.description}
                onClick={() => onPickTrigger(t.type)}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {ACTION_GROUPS.map((group: ActionGroup) => (
              <div key={group} className="flex flex-col gap-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group}</div>
                {ACTION_CATALOG.filter((a) => a.group === group).map((a) => (
                  <Row
                    key={a.type}
                    icon={a.icon}
                    label={a.label}
                    description={a.description}
                    onClick={() => onPickAction(a.type)}
                  />
                ))}
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
