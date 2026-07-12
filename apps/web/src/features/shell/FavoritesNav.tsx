import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router';
import { ChevronDown, Folder, FolderPlus, Link as LinkIcon, Plus, X } from 'lucide-react';
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { type NavigationMenuItem, dataModelApi, navigationApi } from '@/lib/api-client';
import { getIcon } from '@/lib/icons';

type AddMode = 'folder' | 'link' | 'object';

/** Per-member customizable "Favorites" sidebar section: folders + object/link items (gap F1). */
export function FavoritesNav() {
  const queryClient = useQueryClient();
  const { data: items } = useQuery({ queryKey: ['navigation'], queryFn: navigationApi.list });
  const { data: objects } = useQuery({ queryKey: ['data-model-objects'], queryFn: dataModelApi.listObjects });

  const [mode, setMode] = useState<AddMode | null>(null);
  const [targetFolderId, setTargetFolderId] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const [url, setUrl] = useState('');

  const invalidate = (): void => void queryClient.invalidateQueries({ queryKey: ['navigation'] });
  const create = useMutation({ mutationFn: navigationApi.create, onSuccess: invalidate });
  const remove = useMutation({ mutationFn: navigationApi.remove, onSuccess: invalidate });

  function openAdd(m: AddMode, folderId: string | null): void {
    setMode(m);
    setTargetFolderId(folderId);
    setLabel('');
    setUrl('');
  }

  const all = items ?? [];
  const topLevel = all.filter((i) => !i.folderId).sort((a, b) => a.position - b.position);
  const childrenOf = (folderId: string): NavigationMenuItem[] =>
    all.filter((i) => i.folderId === folderId).sort((a, b) => a.position - b.position);

  function pathOf(item: NavigationMenuItem): string {
    if (item.type === 'OBJECT') {
      const obj = objects?.find((o) => o.id === item.targetObjectMetadataId);
      return obj ? `/objects/${obj.namePlural}` : '#';
    }
    return item.link ?? '#';
  }

  function Leaf({ item }: { item: NavigationMenuItem }): React.ReactElement {
    const Icon = getIcon(item.icon ?? (item.type === 'LINK' ? 'Link' : 'Circle'));
    const external = item.type === 'LINK';
    return (
      <div className="group/nav flex items-center">
        <SidebarMenuButton
          tooltip={item.label}
          className="flex-1"
          render={external ? <a href={item.link ?? '#'} target="_blank" rel="noreferrer" /> : <Link to={pathOf(item)} />}
        >
          <Icon />
          <span className="truncate">{item.label}</span>
        </SidebarMenuButton>
        <button
          type="button"
          className="mr-1 opacity-0 group-hover/nav:opacity-100"
          onClick={() => remove.mutate(item.id)}
        >
          <X className="size-3 text-muted-foreground hover:text-destructive" />
        </button>
      </div>
    );
  }

  return (
    <SidebarGroup>
      <SidebarGroupLabel className="flex items-center justify-between">
        Favorites
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="sm" className="size-5 p-0" />}>
            <Plus className="size-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => openAdd('folder', null)}>
              <FolderPlus className="size-3.5" /> New folder
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => openAdd('object', null)}>
              <Plus className="size-3.5" /> Add object
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => openAdd('link', null)}>
              <LinkIcon className="size-3.5" /> Add link
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {topLevel.length === 0 && (
            <p className="px-2 py-1 text-xs text-muted-foreground">Add objects, links, and folders here.</p>
          )}
          {topLevel.map((item) =>
            item.type === 'FOLDER' ? (
              <SidebarMenuItem key={item.id}>
                <div className="group/nav flex items-center">
                  <SidebarMenuButton className="flex-1">
                    <Folder />
                    <span className="truncate">{item.label}</span>
                    <ChevronDown className="ml-auto size-3.5 text-muted-foreground" />
                  </SidebarMenuButton>
                  <DropdownMenu>
                    <DropdownMenuTrigger render={<button type="button" className="mr-1 opacity-0 group-hover/nav:opacity-100" />}>
                      <Plus className="size-3 text-muted-foreground" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openAdd('object', item.id)}>Add object</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => openAdd('link', item.id)}>Add link</DropdownMenuItem>
                      <DropdownMenuItem variant="destructive" onClick={() => remove.mutate(item.id)}>
                        Delete folder
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <SidebarMenuSub>
                  {childrenOf(item.id).map((child) => (
                    <SidebarMenuSubItem key={child.id}>
                      <SidebarMenuSubButton
                        render={
                          child.type === 'LINK' ? (
                            <a href={child.link ?? '#'} target="_blank" rel="noreferrer" />
                          ) : (
                            <Link to={pathOf(child)} />
                          )
                        }
                      >
                        <span className="truncate">{child.label}</span>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  ))}
                </SidebarMenuSub>
              </SidebarMenuItem>
            ) : (
              <SidebarMenuItem key={item.id}>
                <Leaf item={item} />
              </SidebarMenuItem>
            ),
          )}
        </SidebarMenu>
      </SidebarGroupContent>

      <Dialog open={mode !== null} onOpenChange={(o) => !o && setMode(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {mode === 'folder' ? 'New folder' : mode === 'link' ? 'Add link' : 'Add object'}
            </DialogTitle>
          </DialogHeader>

          {mode === 'object' ? (
            <div className="max-h-72 space-y-1 overflow-y-auto">
              {(objects ?? [])
                .filter((o) => o.isActive)
                .map((o) => {
                  const Icon = getIcon(o.icon);
                  return (
                    <button
                      key={o.id}
                      type="button"
                      className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
                      onClick={() => {
                        create.mutate({
                          type: 'OBJECT',
                          label: o.labelPlural,
                          icon: o.icon,
                          targetObjectMetadataId: o.id,
                          folderId: targetFolderId,
                        });
                        setMode(null);
                      }}
                    >
                      <Icon className="size-4" /> {o.labelPlural}
                    </button>
                  );
                })}
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <Label>Name</Label>
                <Input autoFocus value={label} onChange={(e) => setLabel(e.target.value)} />
              </div>
              {mode === 'link' && (
                <div>
                  <Label>URL</Label>
                  <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
                </div>
              )}
              <DialogFooter>
                <Button
                  disabled={!label.trim() || (mode === 'link' && !url.trim())}
                  onClick={() => {
                    create.mutate(
                      mode === 'folder'
                        ? { type: 'FOLDER', label: label.trim(), folderId: null }
                        : { type: 'LINK', label: label.trim(), link: url.trim(), folderId: targetFolderId },
                    );
                    setMode(null);
                  }}
                >
                  Add
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </SidebarGroup>
  );
}
