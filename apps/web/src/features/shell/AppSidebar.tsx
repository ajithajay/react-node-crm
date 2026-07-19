import { useQuery } from '@tanstack/react-query';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarRail,
} from '@/components/ui/sidebar';
import { workspaceApi } from '@/lib/api-client';
import { WorkspaceMenu } from './WorkspaceMenu';
import { WorkspaceNav } from './WorkspaceNav';

export function AppSidebar() {
  const { data: workspace } = useQuery({ queryKey: ['workspace'], queryFn: workspaceApi.getCurrent });

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <WorkspaceMenu workspace={workspace} />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <WorkspaceNav />
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
