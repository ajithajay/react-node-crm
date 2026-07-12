import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  type NavigationMenuItem,
  type PageLayout,
  dataModelApi,
  navigationApi,
} from '@/lib/api-client';

type DraftNavItem = NavigationMenuItem & { isNew?: boolean };

interface PageLayoutEdit {
  objectId: string;
  objectLabel: string;
  original: PageLayout;
  draft: PageLayout;
}

interface LayoutCustomizationState {
  isActive: boolean;
  nav: DraftNavItem[] | null;
  pageLayout: PageLayoutEdit | null;
  isSaving: boolean;
  isDirty: boolean;
  enterSidebarMode: (items: NavigationMenuItem[]) => void;
  enterPageLayoutMode: (objectId: string, objectLabel: string, layout: PageLayout) => void;
  setNav: (updater: (items: DraftNavItem[]) => DraftNavItem[]) => void;
  setPageLayoutDraft: (updater: (layout: PageLayout) => PageLayout) => void;
  save: () => Promise<void>;
  cancel: () => void;
}

const LayoutCustomizationCtx = createContext<LayoutCustomizationState | null>(null);

export function LayoutCustomizationProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [nav, setNavState] = useState<DraftNavItem[] | null>(null);
  const [navOriginal, setNavOriginal] = useState<NavigationMenuItem[] | null>(null);
  const [pageLayout, setPageLayoutState] = useState<PageLayoutEdit | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const isActive = nav !== null || pageLayout !== null;

  const isDirty = useMemo(() => {
    if (nav && navOriginal && JSON.stringify(nav) !== JSON.stringify(navOriginal)) return true;
    if (pageLayout && JSON.stringify(pageLayout.draft) !== JSON.stringify(pageLayout.original)) return true;
    return false;
  }, [nav, navOriginal, pageLayout]);

  const enterSidebarMode = useCallback((items: NavigationMenuItem[]) => {
    setNavState(items.map((i) => ({ ...i })));
    setNavOriginal(items.map((i) => ({ ...i })));
  }, []);

  const enterPageLayoutMode = useCallback((objectId: string, objectLabel: string, layout: PageLayout) => {
    setPageLayoutState({ objectId, objectLabel, original: layout, draft: structuredClone(layout) });
  }, []);

  const setNav = useCallback((updater: (items: DraftNavItem[]) => DraftNavItem[]) => {
    setNavState((prev) => (prev ? updater(prev) : prev));
  }, []);

  const setPageLayoutDraft = useCallback((updater: (layout: PageLayout) => PageLayout) => {
    setPageLayoutState((prev) => (prev ? { ...prev, draft: updater(prev.draft) } : prev));
  }, []);

  const cancel = useCallback(() => {
    setNavState(null);
    setNavOriginal(null);
    setPageLayoutState(null);
  }, []);

  const save = useCallback(async () => {
    setIsSaving(true);
    try {
      if (nav && navOriginal) {
        const draftIds = new Set(nav.map((i) => i.id));
        const removed = navOriginal.filter((i) => !draftIds.has(i.id));
        const idRemap = new Map<string, string>();

        for (const item of removed) await navigationApi.remove(item.id);

        // Created items (isNew, or a folder's own id was remapped) may reference a temp folderId —
        // create top-level/known-parent items first, then resolve children in a second pass.
        const toCreate = nav.filter((i) => i.isNew);
        const toCreateOrdered = [...toCreate].sort((a, b) => (a.folderId ? 1 : 0) - (b.folderId ? 1 : 0));
        for (const item of toCreateOrdered) {
          const folderId = item.folderId ? (idRemap.get(item.folderId) ?? item.folderId) : null;
          const created = await navigationApi.create({
            type: item.type,
            label: item.label,
            icon: item.icon,
            color: item.color,
            folderId,
            targetObjectMetadataId: item.targetObjectMetadataId,
            viewId: item.viewId,
            link: item.link,
          });
          idRemap.set(item.id, created.id);
        }

        const originalById = new Map(navOriginal.map((i) => [i.id, i]));
        for (const item of nav) {
          if (item.isNew) continue;
          const orig = originalById.get(item.id);
          if (!orig) continue;
          const folderId = item.folderId ? (idRemap.get(item.folderId) ?? item.folderId) : null;
          if (
            orig.label !== item.label ||
            orig.icon !== item.icon ||
            orig.color !== item.color ||
            orig.folderId !== folderId ||
            orig.position !== item.position
          ) {
            await navigationApi.update(item.id, { label: item.label, icon: item.icon, color: item.color, folderId, position: item.position });
          }
        }

        await queryClient.invalidateQueries({ queryKey: ['navigation'] });
      }

      if (pageLayout) {
        await dataModelApi.savePageLayout(pageLayout.objectId, {
          tabs: pageLayout.draft.tabs.map((tab) => ({
            id: tab.id.startsWith('new-') ? undefined : tab.id,
            title: tab.title,
            icon: tab.icon,
            isVisible: tab.isVisible,
            widgets: tab.widgets.map((widget) => ({
              id: widget.id.startsWith('new-') ? undefined : widget.id,
              type: widget.type,
              title: widget.title,
              isVisible: widget.isVisible,
              groups:
                widget.type === 'FIELDS'
                  ? widget.groups.map((g) => ({
                      id: g.id.startsWith('new-') ? undefined : g.id,
                      label: g.label,
                      isVisible: g.isVisible,
                      fields: g.fields.map((f) => ({ fieldMetadataId: f.fieldMetadataId, isVisible: f.isVisible })),
                    }))
                  : undefined,
            })),
          })),
        });
        await queryClient.invalidateQueries({ queryKey: ['page-layout', pageLayout.objectId] });
      }

      setNavState(null);
      setNavOriginal(null);
      setPageLayoutState(null);
    } finally {
      setIsSaving(false);
    }
  }, [nav, navOriginal, pageLayout, queryClient]);

  const value: LayoutCustomizationState = {
    isActive,
    nav,
    pageLayout,
    isSaving,
    isDirty,
    enterSidebarMode,
    enterPageLayoutMode,
    setNav,
    setPageLayoutDraft,
    save,
    cancel,
  };

  return <LayoutCustomizationCtx.Provider value={value}>{children}</LayoutCustomizationCtx.Provider>;
}

export function useLayoutCustomization(): LayoutCustomizationState {
  const ctx = useContext(LayoutCustomizationCtx);
  if (!ctx) throw new Error('useLayoutCustomization must be used within LayoutCustomizationProvider');
  return ctx;
}

let tempIdCounter = 0;
/** A client-only id for a not-yet-persisted draft item; replaced by the server id on save. */
export function makeTempId(prefix: string): string {
  tempIdCounter += 1;
  return `new-${prefix}-${tempIdCounter}`;
}
