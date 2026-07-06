import { useQuery } from '@tanstack/react-query';
import { Link, useLocation } from 'react-router';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
} from '@/components/ui/sidebar';
import { workspaceApi } from '@/lib/api-client';
import { NAV_ITEMS, WORKFLOWS_NAV } from './nav-items';
import { WorkspaceMenu } from './WorkspaceMenu';

export function AppSidebar() {
  const location = useLocation();
  const { data: workspace } = useQuery({ queryKey: ['workspace'], queryFn: workspaceApi.getCurrent });

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <WorkspaceMenu workspace={workspace} />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton
                    isActive={location.pathname.startsWith(item.path)}
                    tooltip={item.label}
                    render={<Link to={item.path} />}
                  >
                    <item.icon />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}

              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={location.pathname.startsWith(WORKFLOWS_NAV.path)}
                  tooltip={WORKFLOWS_NAV.label}
                  render={<Link to={WORKFLOWS_NAV.path} />}
                >
                  <WORKFLOWS_NAV.icon />
                  <span>{WORKFLOWS_NAV.label}</span>
                </SidebarMenuButton>
                <SidebarMenuSub>
                  {WORKFLOWS_NAV.children.map((child) => (
                    <SidebarMenuSubItem key={child.path}>
                      <SidebarMenuSubButton isActive={location.pathname === child.path} render={<Link to={child.path} />}>
                        <span>{child.label}</span>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  ))}
                </SidebarMenuSub>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
