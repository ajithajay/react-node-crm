import type { LucideIcon } from 'lucide-react';
import { LayoutDashboard, Workflow } from 'lucide-react';

export interface NavItem {
  label: string;
  path: string;
  icon: LucideIcon;
}

/**
 * Hardcoded, non-customizable sidebar entries — Companies/People/Opportunities/Tasks/Notes moved to
 * real `navigation_menu_items` rows (Twenty parity: every real object is an explicit sidebar item,
 * seeded by default, editable in layout-customization mode; see `navigation.service.ts`). Dashboards
 * and Workflows have no backing object metadata (Phase 7/8 placeholders), so they stay here.
 */
export const NAV_ITEMS: NavItem[] = [{ label: 'Dashboards', path: '/dashboards', icon: LayoutDashboard }];

export const WORKFLOWS_NAV = {
  label: 'Workflows',
  path: '/workflows',
  icon: Workflow,
  children: [
    { label: 'All Workflows', path: '/workflows' },
    { label: 'All Runs', path: '/workflows/runs' },
    { label: 'All Versions', path: '/workflows/versions' },
  ],
};
