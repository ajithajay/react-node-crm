import { GripVertical, Settings2, X } from 'lucide-react';
import type { ReactNode } from 'react';
import type { DashboardWidget } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { WIDGET_TYPE_ICONS } from '../lib/widget-defaults';

/** Card chrome around a widget's rendered content — drag handle + edit/delete controls only show in
 * edit mode (matches the record-page layout editor's `WidgetEditPanel` pattern). */
export function WidgetCard({
  widget,
  editMode,
  onEdit,
  onDelete,
  children,
}: {
  widget: DashboardWidget;
  editMode: boolean;
  onEdit: () => void;
  onDelete: () => void;
  children: ReactNode;
}) {
  const Icon = WIDGET_TYPE_ICONS[widget.type];

  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-lg border bg-card shadow-sm">
      <div className="drag-handle flex shrink-0 items-center gap-1.5 border-b px-3 py-1.5">
        {editMode && <GripVertical className="size-3.5 shrink-0 cursor-move text-muted-foreground" />}
        <Icon className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate text-xs font-medium">{widget.title}</span>
        {editMode && (
          <div className="ml-auto flex items-center gap-0.5">
            <Button variant="ghost" size="icon-xs" onClick={onEdit} aria-label="Configure widget">
              <Settings2 className="size-3.5" />
            </Button>
            <Button variant="ghost" size="icon-xs" onClick={onDelete} aria-label="Delete widget">
              <X className="size-3.5" />
            </Button>
          </div>
        )}
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}
