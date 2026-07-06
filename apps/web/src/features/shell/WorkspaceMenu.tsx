import { ChevronsUpDown, LogOut, Settings, UserPlus } from 'lucide-react';
import { useNavigate } from 'react-router';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';
import { authApi, type CurrentWorkspace } from '@/lib/api-client';
import { useAuthSession } from '@/lib/auth-session';

function initialsOf(name: string): string {
  return name.trim().charAt(0).toUpperCase() || '?';
}

export function WorkspaceMenu({ workspace }: { workspace: CurrentWorkspace | undefined }) {
  const navigate = useNavigate();
  const { clearSession } = useAuthSession();
  const name = workspace?.name ?? 'Loading…';

  async function handleLogout(): Promise<void> {
    await authApi.logout().catch(() => undefined);
    clearSession();
    navigate('/login', { replace: true });
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton size="lg">
                <Avatar className="size-6 rounded-md">
                  {workspace?.logoUrl && <AvatarImage src={workspace.logoUrl} alt={name} />}
                  <AvatarFallback className="rounded-md">{initialsOf(name)}</AvatarFallback>
                </Avatar>
                <span className="truncate font-medium">{name}</span>
                <ChevronsUpDown className="ml-auto size-4 text-sidebar-foreground/50" />
              </SidebarMenuButton>
            }
          />
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuItem onClick={() => navigate('/settings/members')}>
              <UserPlus /> Invite user
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate('/settings')}>
              <Settings /> Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} variant="destructive">
              <LogOut /> Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
