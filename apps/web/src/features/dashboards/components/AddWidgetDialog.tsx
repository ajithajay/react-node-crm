import { useState } from 'react';
import type { DashboardWidgetType, GraphType } from '@/lib/api-client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DASHBOARD_WIDGET_TYPES, GRAPH_TYPES } from '@saasly/shared';
import { GRAPH_TYPE_ICONS, GRAPH_TYPE_LABELS, WIDGET_TYPE_ICONS, WIDGET_TYPE_LABELS } from '../lib/widget-defaults';

/** Two-step "Add widget" flow — pick a widget type, then (for GRAPH) a chart sub-type. Controlled
 * (`open`/`onOpenChange`) so it can be triggered either from the toolbar's "Add widget" button or
 * from a drag-selected empty area on the grid. */
export function AddWidgetDialog({
  open,
  onOpenChange,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (type: DashboardWidgetType, graphType?: GraphType) => void;
}) {
  const [step, setStep] = useState<'type' | 'chart'>('type');

  function reset(): void {
    setStep('type');
    onOpenChange(false);
  }

  function handlePickType(type: DashboardWidgetType): void {
    if (type === 'GRAPH') {
      setStep('chart');
      return;
    }
    onAdd(type);
    reset();
  }

  function handlePickChart(graphType: GraphType): void {
    onAdd('GRAPH', graphType);
    reset();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setStep('type');
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{step === 'type' ? 'Add widget' : 'Choose a chart type'}</DialogTitle>
        </DialogHeader>
        {step === 'type' ? (
          <div className="grid grid-cols-2 gap-3">
            {DASHBOARD_WIDGET_TYPES.map((type) => {
              const Icon = WIDGET_TYPE_ICONS[type];
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => handlePickType(type)}
                  className="flex flex-col items-center gap-2 rounded-lg border p-4 text-sm hover:bg-accent"
                >
                  <Icon className="size-6 text-muted-foreground" />
                  {WIDGET_TYPE_LABELS[type]}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {GRAPH_TYPES.map((graphType) => {
              const Icon = GRAPH_TYPE_ICONS[graphType];
              return (
                <button
                  key={graphType}
                  type="button"
                  onClick={() => handlePickChart(graphType)}
                  className="flex flex-col items-center gap-2 rounded-lg border p-4 text-sm hover:bg-accent"
                >
                  <Icon className="size-6 text-muted-foreground" />
                  {GRAPH_TYPE_LABELS[graphType]}
                </button>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
