import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { SidebarMenu, SidebarMenuItem } from '@/components/ui/sidebar';
import { resolveFileUrl, type CurrentWorkspace } from '@/lib/api-client';

function initialsOf(name: string): string {
  return name.trim().charAt(0).toUpperCase() || '?';
}

export function WorkspaceMenu({ workspace }: { workspace: CurrentWorkspace | undefined }) {
  const name = workspace?.name ?? 'Loading…';

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <div className="flex h-12 w-full items-center gap-2 overflow-hidden rounded-md p-2 text-sm group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-0!">
          <Avatar className="size-6 rounded-md">
            {workspace?.logoUrl && <AvatarImage src={resolveFileUrl(workspace.logoUrl) ?? undefined} alt={name} />}
            <AvatarFallback className="rounded-md">{initialsOf(name)}</AvatarFallback>
          </Avatar>
          <span className="truncate font-medium">{name}</span>
        </div>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
