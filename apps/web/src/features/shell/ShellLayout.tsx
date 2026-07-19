import { useQuery } from '@tanstack/react-query';
import { Outlet } from 'react-router';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { meApi } from '@/lib/api-client';
import { useColorSchemeSync } from '@/lib/theme';
import { LayoutCustomizationBar } from '@/features/layout-customization/LayoutCustomizationBar';
import { LayoutCustomizationProvider } from '@/features/layout-customization/LayoutCustomizationContext';
import { RunWorkflowActions } from '@/features/workflows/components/RunWorkflowActions';
import { AppSidebar } from './AppSidebar';
import { GlobalSearch } from './GlobalSearch';
import { UserMenu } from './UserMenu';

export function ShellLayout() {
  const { data: me } = useQuery({ queryKey: ['me'], queryFn: meApi.get });
  useColorSchemeSync(me?.colorScheme);

  return (
    <LayoutCustomizationProvider>
      <div className="flex h-dvh flex-col">
        <LayoutCustomizationBar />
        <SidebarProvider className="min-h-0 flex-1">
          <AppSidebar />
          <SidebarInset>
            <header className="flex h-12 shrink-0 items-center gap-2 border-b border-sidebar-border bg-[image:var(--header-gradient)] px-3 backdrop-blur-xl">
              <SidebarTrigger />
              <Separator orientation="vertical" className="h-4" />
              <div className="flex-1" />
              <RunWorkflowActions availability="GLOBAL" buildPayload={() => ({})} />
              <GlobalSearch />
              <UserMenu me={me} />
            </header>
            <div className="flex-1 overflow-auto p-6">
              <Outlet />
            </div>
          </SidebarInset>
        </SidebarProvider>
      </div>
    </LayoutCustomizationProvider>
  );
}
