import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { ChevronDown, Folder, Link as LinkIcon, Plus, Table2 } from 'lucide-react';
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { type NavigationMenuItem, dataModelApi, navigationApi, viewApi } from '@/lib/api-client';
import { getIcon } from '@/lib/icons';
import { TAG_COLORS } from '@/features/objects/lib/table-tokens';
import { makeTempId, useLayoutCustomization } from '@/features/layout-customization/LayoutCustomizationContext';

const COLOR_NAMES = Object.keys(TAG_COLORS);

/** Right-side panel for an existing item: Customize (color) + Organize (move/folder/remove). Twenty parity. */
function ItemEditPanel({
  item,
  items,
  onClose,
  onUpdate,
  onMove,
  onRemove,
}: {
  item: NavigationMenuItem;
  items: NavigationMenuItem[];
  onClose: () => void;
  onUpdate: (patch: Partial<NavigationMenuItem>) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
}) {
  const [pickingFolder, setPickingFolder] = useState(false);
  const folders = items.filter((i) => i.type === 'FOLDER' && i.id !== item.id);
  const Icon = getIcon(item.icon ?? 'Circle');
  const color = item.color ?? 'blue';

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-80">
        <SheetHeader className="border-b">
          <SheetTitle className="flex items-center gap-2">
            <Icon className="size-4" style={{ color: TAG_COLORS[color]?.text }} />
            {item.label}
          </SheetTitle>
        </SheetHeader>
        <div className="space-y-6 px-4 py-4">
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Customize</h3>
            <div className="flex items-center justify-between text-sm">
              <span>Color</span>
              <Select value={color} onValueChange={(c) => c && onUpdate({ color: c })}>
                <SelectTrigger className="h-8 w-32 capitalize">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COLOR_NAMES.map((c) => (
                    <SelectItem key={c} value={c} className="capitalize">
                      <span className="mr-1.5 inline-block size-2.5 rounded-full" style={{ backgroundColor: TAG_COLORS[c]!.text }} />
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Organize</h3>
            <div className="space-y-0.5">
              <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => onMove(-1)}>
                Move up
              </Button>
              <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => onMove(1)}>
                Move down
              </Button>
              {item.type !== 'FOLDER' && (
                <div>
                  <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => setPickingFolder((p) => !p)}>
                    Move to folder
                  </Button>
                  {pickingFolder && (
                    <div className="ml-3 space-y-0.5 border-l pl-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start text-muted-foreground"
                        onClick={() => {
                          onUpdate({ folderId: null });
                          setPickingFolder(false);
                        }}
                      >
                        No folder
                      </Button>
                      {folders.map((f) => (
                        <Button
                          key={f.id}
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start"
                          onClick={() => {
                            onUpdate({ folderId: f.id });
                            setPickingFolder(false);
                          }}
                        >
                          {f.label}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <Button variant="ghost" size="sm" className="w-full justify-start text-destructive hover:text-destructive" onClick={onRemove}>
                Remove from sidebar
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

type AddStep = 'menu' | 'object' | 'view-object' | 'view-picker' | 'folder' | 'link';

/** "+ Add menu item" panel: Data (Object, View) / Other (Folder, Link). Record is out of scope this
 * pass (a pinned single record needs a record-search picker — a separate, larger feature). */
function AddItemPanel({ onClose, onAdd }: { onClose: () => void; onAdd: (input: Omit<NavigationMenuItem, 'id' | 'position'>) => void }) {
  const [step, setStep] = useState<AddStep>('menu');
  const [pendingObjectId, setPendingObjectId] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const [url, setUrl] = useState('');

  const { data: objects } = useQuery({ queryKey: ['data-model-objects'], queryFn: dataModelApi.listObjects });
  const activeObjects = (objects ?? []).filter((o) => o.isActive);

  const { data: views } = useQuery({
    queryKey: ['views', pendingObjectId],
    queryFn: () => viewApi.list(pendingObjectId!),
    enabled: step === 'view-picker' && !!pendingObjectId,
  });

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-80">
        <SheetHeader className="border-b">
          <SheetTitle>
            {step === 'menu' && 'New menu item'}
            {step === 'object' && 'Add object'}
            {(step === 'view-object' || step === 'view-picker') && 'Add view'}
            {step === 'folder' && 'New folder'}
            {step === 'link' && 'Add link'}
          </SheetTitle>
        </SheetHeader>

        {step === 'menu' && (
          <div className="space-y-4 px-4 py-4">
            <div>
              <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Data</h3>
              <div className="space-y-0.5">
                <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => setStep('object')}>
                  <Table2 className="size-3.5" /> Object
                </Button>
                <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => setStep('view-object')}>
                  <Table2 className="size-3.5" /> View
                </Button>
              </div>
            </div>
            <div>
              <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Other</h3>
              <div className="space-y-0.5">
                <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => setStep('folder')}>
                  <Folder className="size-3.5" /> Folder
                </Button>
                <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => setStep('link')}>
                  <LinkIcon className="size-3.5" /> Link
                </Button>
              </div>
            </div>
          </div>
        )}

        {(step === 'object' || step === 'view-object') && (
          <div className="max-h-96 space-y-1 overflow-y-auto px-4 py-4">
            {activeObjects.map((o) => {
              const Icon = getIcon(o.icon);
              return (
                <button
                  key={o.id}
                  type="button"
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
                  onClick={() => {
                    if (step === 'object') {
                      onAdd({
                        type: 'OBJECT',
                        label: o.labelPlural,
                        icon: o.icon,
                        color: null,
                        targetObjectMetadataId: o.id,
                        viewId: null,
                        link: null,
                        folderId: null,
                      });
                    } else {
                      setPendingObjectId(o.id);
                      setStep('view-picker');
                    }
                  }}
                >
                  <Icon className="size-4" /> {o.labelPlural}
                </button>
              );
            })}
          </div>
        )}

        {step === 'view-picker' && (
          <div className="max-h-96 space-y-1 overflow-y-auto px-4 py-4">
            {(views ?? []).length === 0 && <p className="text-sm text-muted-foreground">No views on this object yet.</p>}
            {(views ?? []).map((v) => (
              <button
                key={v.id}
                type="button"
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
                onClick={() =>
                  onAdd({
                    type: 'VIEW',
                    label: v.name,
                    icon: v.icon ?? 'Table2',
                    color: null,
                    targetObjectMetadataId: pendingObjectId,
                    viewId: v.id,
                    link: null,
                    folderId: null,
                  })
                }
              >
                <Table2 className="size-4" /> {v.name}
              </button>
            ))}
          </div>
        )}

        {(step === 'folder' || step === 'link') && (
          <div className="space-y-3 px-4 py-4">
            <div>
              <Label>Name</Label>
              <Input autoFocus value={label} onChange={(e) => setLabel(e.target.value)} />
            </div>
            {step === 'link' && (
              <div>
                <Label>URL</Label>
                <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
              </div>
            )}
            <Button
              disabled={!label.trim() || (step === 'link' && !url.trim())}
              onClick={() =>
                onAdd(
                  step === 'folder'
                    ? { type: 'FOLDER', label: label.trim(), icon: null, color: null, folderId: null, targetObjectMetadataId: null, viewId: null, link: null }
                    : { type: 'LINK', label: label.trim(), icon: null, color: null, link: url.trim(), folderId: null, targetObjectMetadataId: null, viewId: null },
                )
              }
            >
              Add
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

/**
 * Unified sidebar item list (Twenty parity — no separate "Favorites" bucket; every real object,
 * standard or custom, is an explicit `navigation_menu_item`, seeded by default for new members).
 * Read-only outside layout-customization mode; inside it, clicking an item opens its edit panel and
 * a trailing "+ Add menu item" row is shown.
 */
export function WorkspaceNav() {
  const { data: liveItems } = useQuery({ queryKey: ['navigation'], queryFn: navigationApi.list });
  const { data: objects } = useQuery({ queryKey: ['data-model-objects'], queryFn: dataModelApi.listObjects });
  const { nav: draftItems, setNav } = useLayoutCustomization();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const isEditing = draftItems !== null;
  const all = isEditing ? draftItems : (liveItems ?? []);
  const editingItem = all.find((i) => i.id === editingId);

  function pathOf(item: NavigationMenuItem): string {
    if (item.type === 'OBJECT') {
      const obj = objects?.find((o) => o.id === item.targetObjectMetadataId);
      return obj ? `/objects/${obj.namePlural}` : '#';
    }
    if (item.type === 'VIEW') {
      const obj = objects?.find((o) => o.id === item.targetObjectMetadataId);
      return obj ? `/objects/${obj.namePlural}` : '#';
    }
    return item.link ?? '#';
  }

  function updateItem(id: string, patch: Partial<NavigationMenuItem>): void {
    setNav((items) => items.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }

  function moveItem(id: string, dir: -1 | 1): void {
    setNav((items) => {
      const item = items.find((i) => i.id === id);
      if (!item) return items;
      const siblings = items.filter((i) => i.folderId === item.folderId).sort((a, b) => a.position - b.position);
      const idx = siblings.findIndex((i) => i.id === id);
      const swapWith = siblings[idx + dir];
      if (!swapWith) return items;
      return items.map((i) => {
        if (i.id === item.id) return { ...i, position: swapWith.position };
        if (i.id === swapWith.id) return { ...i, position: item.position };
        return i;
      });
    });
  }

  function removeItem(id: string): void {
    setNav((items) => items.filter((i) => i.id !== id && i.folderId !== id));
    setEditingId(null);
  }

  function addItem(input: Omit<NavigationMenuItem, 'id' | 'position'>): void {
    setNav((items) => {
      const siblingPositions = items.filter((i) => i.folderId === (input.folderId ?? null)).map((i) => i.position);
      const position = siblingPositions.length ? Math.max(...siblingPositions) + 1 : 0;
      return [...items, { ...input, id: makeTempId(input.type.toLowerCase()), position, isNew: true }];
    });
    setAdding(false);
  }

  const topLevel = all.filter((i) => !i.folderId).sort((a, b) => a.position - b.position);
  const childrenOf = (folderId: string): NavigationMenuItem[] =>
    all.filter((i) => i.folderId === folderId).sort((a, b) => a.position - b.position);

  function ItemButton({ item, asSub = false }: { item: NavigationMenuItem; asSub?: boolean }): React.ReactElement {
    const Icon = getIcon(item.icon ?? (item.type === 'LINK' ? 'Link' : 'Circle'));
    const external = item.type === 'LINK';
    const style = item.color ? { color: TAG_COLORS[item.color]?.text } : undefined;
    const content = (
      <>
        <Icon style={style} />
        <span className="truncate">{item.label}</span>
      </>
    );

    if (isEditing) {
      return asSub ? (
        <SidebarMenuSubButton onClick={() => setEditingId(item.id)}>{content}</SidebarMenuSubButton>
      ) : (
        <SidebarMenuButton onClick={() => setEditingId(item.id)}>{content}</SidebarMenuButton>
      );
    }

    if (asSub) {
      return (
        <SidebarMenuSubButton render={external ? <a href={item.link ?? '#'} target="_blank" rel="noreferrer" /> : <Link to={pathOf(item)} />}>
          {content}
        </SidebarMenuSubButton>
      );
    }
    return (
      <SidebarMenuButton tooltip={item.label} render={external ? <a href={item.link ?? '#'} target="_blank" rel="noreferrer" /> : <Link to={pathOf(item)} />}>
        {content}
      </SidebarMenuButton>
    );
  }

  return (
    <>
      <SidebarMenu>
        {topLevel.map((item) =>
          item.type === 'FOLDER' ? (
            <SidebarMenuItem key={item.id}>
              {isEditing ? (
                <SidebarMenuButton onClick={() => setEditingId(item.id)}>
                  <Folder style={item.color ? { color: TAG_COLORS[item.color]?.text } : undefined} />
                  <span className="truncate">{item.label}</span>
                </SidebarMenuButton>
              ) : (
                <SidebarMenuButton>
                  <Folder style={item.color ? { color: TAG_COLORS[item.color]?.text } : undefined} />
                  <span className="truncate">{item.label}</span>
                  <ChevronDown className="ml-auto size-3.5 text-muted-foreground" />
                </SidebarMenuButton>
              )}
              <SidebarMenuSub>
                {childrenOf(item.id).map((child) => (
                  <SidebarMenuSubItem key={child.id}>
                    <ItemButton item={child} asSub />
                  </SidebarMenuSubItem>
                ))}
              </SidebarMenuSub>
            </SidebarMenuItem>
          ) : (
            <SidebarMenuItem key={item.id}>
              <ItemButton item={item} />
            </SidebarMenuItem>
          ),
        )}

        {isEditing && (
          <SidebarMenuItem>
            <SidebarMenuButton onClick={() => setAdding(true)} className="text-muted-foreground">
              <Plus />
              <span>Add menu item</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        )}
      </SidebarMenu>

      {editingItem && (
        <ItemEditPanel
          item={editingItem}
          items={all}
          onClose={() => setEditingId(null)}
          onUpdate={(patch) => updateItem(editingItem.id, patch)}
          onMove={(dir) => moveItem(editingItem.id, dir)}
          onRemove={() => removeItem(editingItem.id)}
        />
      )}
      {adding && <AddItemPanel onClose={() => setAdding(false)} onAdd={addItem} />}
    </>
  );
}
