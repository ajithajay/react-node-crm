import type { LucideIcon } from 'lucide-react';
import { Building2, CheckSquare, LayoutDashboard, StickyNote, Target, Users, Workflow } from 'lucide-react';

export interface NavItem {
  label: string;
  path: string;
  icon: LucideIcon;
}

/** Sidebar objects, in the order specified by brd.md §3. */
export const NAV_ITEMS: NavItem[] = [
  { label: 'Companies', path: '/companies', icon: Building2 },
  { label: 'People', path: '/people', icon: Users },
  { label: 'Opportunities', path: '/opportunities', icon: Target },
  { label: 'Tasks', path: '/tasks', icon: CheckSquare },
  { label: 'Notes', path: '/notes', icon: StickyNote },
  { label: 'Dashboards', path: '/dashboards', icon: LayoutDashboard },
];

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
