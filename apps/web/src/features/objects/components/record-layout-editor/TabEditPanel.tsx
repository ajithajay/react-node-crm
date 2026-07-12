import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { type PageLayout, type PageLayoutTab } from '@/lib/api-client';
import * as draft from '../../lib/page-layout-draft';

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{children}</h3>;
}

/**
 * Right-side panel for a tab (Twenty parity — matches the sidebar item panel's structure).
 * The Home tab (holding the FIELDS widget) is rendered as a static left column, not a switchable
 * tab, so it gets only Rename + Reset here — Placement/Pin/Move have no visible effect on it.
 */
export function TabEditPanel({
  tab,
  isHome,
  index,
  count,
  onClose,
  onUpdateLayout,
  onDelete,
}: {
  tab: PageLayoutTab;
  isHome: boolean;
  index: number;
  count: number;
  onClose: () => void;
  onUpdateLayout: (updater: (l: PageLayout) => PageLayout) => void;
  onDelete: () => void;
}) {
  const [title, setTitle] = useState(tab.title);

  function commitTitle(): void {
    if (title.trim() && title !== tab.title) onUpdateLayout((l) => draft.renameTab(l, tab.id, title.trim()));
  }

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-80">
        <SheetHeader className="border-b">
          <SheetTitle>{tab.title}</SheetTitle>
        </SheetHeader>
        <div className="space-y-6 px-4 py-4">
          <div>
            <Label>Name</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} onBlur={commitTitle} className="mt-1" />
          </div>

          {!isHome && (
            <div>
              <SectionLabel>Placement</SectionLabel>
              <div className="space-y-0.5">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => onUpdateLayout((l) => draft.pinTab(l, tab.id))}
                >
                  {tab.isPinned ? 'Unpin tab' : 'Pin tab'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start"
                  disabled={index === 0}
                  onClick={() => onUpdateLayout((l) => draft.moveTab(l, tab.id, -1))}
                >
                  Move left
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start"
                  disabled={index === count - 1}
                  onClick={() => onUpdateLayout((l) => draft.moveTab(l, tab.id, 1))}
                >
                  Move right
                </Button>
              </div>
            </div>
          )}

          <div>
            <SectionLabel>Manage</SectionLabel>
            <div className="space-y-0.5">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start"
                onClick={() =>
                  onUpdateLayout((l) =>
                    draft.updateTab(l, tab.id, (t) => ({
                      ...t,
                      isVisible: true,
                      widgets: t.widgets.map((w) => ({
                        ...w,
                        isVisible: true,
                        configuration: w.type === 'FIELDS' ? { showMoreFieldsButton: false, autoVisibleNewFields: true } : {},
                      })),
                    })),
                  )
                }
              >
                Reset to default
              </Button>
              {!isHome && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-destructive hover:text-destructive"
                  onClick={onDelete}
                >
                  Delete tab
                </Button>
              )}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
