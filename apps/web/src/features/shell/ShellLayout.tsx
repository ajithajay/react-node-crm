import { useQuery } from '@tanstack/react-query';
import { Outlet } from 'react-router';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { meApi } from '@/lib/api-client';
import { useColorSchemeSync } from '@/lib/theme';
import { LayoutCustomizationBar } from '@/features/layout-customization/LayoutCustomizationBar';
import { LayoutCustomizationProvider } from '@/features/layout-customization/LayoutCustomizationContext';
import { AppSidebar } from './AppSidebar';

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
            <header className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
              <SidebarTrigger />
              <Separator orientation="vertical" className="h-4" />
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
