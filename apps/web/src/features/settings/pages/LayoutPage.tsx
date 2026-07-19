import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { LayoutGrid, ListTree, Pencil, Table2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { dataModelApi, navigationApi, viewApi } from '@/lib/api-client';
import { useLayoutCustomization } from '@/features/layout-customization/LayoutCustomizationContext';

/** One real workspace-scoped count. Commands/Dashboards stay out of scope (no command menu / Phase 7 dashboards yet). */
function useLayoutStats() {
  const { data: navItems } = useQuery({ queryKey: ['navigation'], queryFn: navigationApi.list });
  const { data: objects } = useQuery({ queryKey: ['data-model-objects'], queryFn: dataModelApi.listObjects });
  const activeObjects = (objects ?? []).filter((o) => o.isActive);

  const { data: viewsPerObject } = useQuery({
    queryKey: ['layout-stats-views', activeObjects.map((o) => o.id).join(',')],
    queryFn: () => Promise.all(activeObjects.map((o) => viewApi.list(o.id))),
    enabled: activeObjects.length > 0,
  });
  const { data: widgetsPerObject } = useQuery({
    queryKey: ['layout-stats-widgets', activeObjects.map((o) => o.id).join(',')],
    queryFn: () => Promise.all(activeObjects.map((o) => dataModelApi.getPageLayout(o.id))),
    enabled: activeObjects.length > 0,
  });

  return {
    sidebarItems: navItems?.length ?? 0,
    pages: activeObjects.length,
    views: viewsPerObject?.reduce((sum, v) => sum + v.length, 0) ?? 0,
    widgets: widgetsPerObject?.reduce((sum, l) => sum + l.tabs.flatMap((t) => t.widgets).length, 0) ?? 0,
  };
}

/**
 * Settings → Layout landing page: an overview + a single "Customize" entry point
 * into the global layout-customization mode, which edits the sidebar in place (record-page layouts
 * are customized per-object, from Data Model → Object → Layout).
 */
export function LayoutPage() {
  const navigate = useNavigate();
  const { enterSidebarMode } = useLayoutCustomization();
  const { data: navItems } = useQuery({ queryKey: ['navigation'], queryFn: navigationApi.list });
  const stats = useLayoutStats();

  function handleCustomize(): void {
    enterSidebarMode(navItems ?? []);
    navigate('/');
  }

  return (
    <div>
      <h1 className="text-lg font-medium">Layout</h1>
      <p className="mt-1 text-sm text-muted-foreground">Customize how your workspace looks.</p>

      <Card className="mt-4">
        <CardContent className="flex items-center justify-between gap-4 p-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-md bg-muted">
              <LayoutGrid className="size-5 text-muted-foreground" />
            </div>
            <div>
              <div className="font-medium">Customize layout</div>
              <div className="text-sm text-muted-foreground">Customize how your workspace looks.</div>
            </div>
          </div>
          <Button onClick={handleCustomize}>
            <Pencil className="size-4" /> Customize
          </Button>
        </CardContent>
      </Card>

      <div className="mt-6">
        <h2 className="text-sm font-medium">Overview</h2>
        <p className="text-sm text-muted-foreground">All the layout items declared on your workspace</p>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard icon={ListTree} label="Sidebar items" value={stats.sidebarItems} />
          <StatCard icon={Table2} label="Views" value={stats.views} />
          <StatCard icon={LayoutGrid} label="Widgets" value={stats.widgets} />
          <StatCard icon={LayoutGrid} label="Pages" value={stats.pages} />
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: typeof LayoutGrid; label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Icon className="size-3.5" />
          {label}
        </div>
        <div className="mt-1 text-xl font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}
