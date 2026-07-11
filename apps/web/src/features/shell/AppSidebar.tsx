import { useQuery } from '@tanstack/react-query';
import { Link, useLocation } from 'react-router';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
} from '@/components/ui/sidebar';
import { dataModelApi, workspaceApi } from '@/lib/api-client';
import { getIcon } from '@/lib/icons';
import { NAV_ITEMS, WORKFLOWS_NAV } from './nav-items';
import { WorkspaceMenu } from './WorkspaceMenu';

export function AppSidebar() {
  const location = useLocation();
  const { data: workspace } = useQuery({ queryKey: ['workspace'], queryFn: workspaceApi.getCurrent });
  const { data: objects } = useQuery({ queryKey: ['data-model-objects'], queryFn: dataModelApi.listObjects });
  const customObjects = (objects ?? []).filter((o) => o.isCustom && o.isActive);

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

        {customObjects.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Custom Objects</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {customObjects.map((object) => {
                  const Icon = getIcon(object.icon);
                  const path = `/objects/${object.namePlural}`;
                  return (
                    <SidebarMenuItem key={object.id}>
                      <SidebarMenuButton
                        isActive={location.pathname.startsWith(path)}
                        tooltip={object.labelPlural}
                        render={<Link to={path} />}
                      >
                        <Icon />
                        <span>{object.labelPlural}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
