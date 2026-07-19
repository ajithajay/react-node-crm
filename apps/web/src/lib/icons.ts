import * as LucideIcons from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/** Role/permission icons are stored as lucide-react export names, e.g. "ShieldCheck". */
export function getIcon(name: string): LucideIcon {
  return (LucideIcons as unknown as Record<string, LucideIcon | undefined>)[name] ?? LucideIcons.Circle;
}

/**
 * Every icon lucide-react ships, deduped (the package double-exports each icon under both its
 * short name and a `*Icon`-suffixed alias) — lets the icon picker search the full library instead
 * of a small curated list.
 */
export const ALL_ICON_NAMES: string[] = Object.keys(LucideIcons)
  .filter((name) => {
    const value = (LucideIcons as unknown as Record<string, unknown>)[name];
    return typeof value === 'object' && value !== null && name !== 'icons' && !name.endsWith('Icon');
  })
  .sort();

/** A curated set offered by the role icon picker — not every lucide icon makes sense here. */
export const ROLE_ICON_OPTIONS = [
  'User',
  'Users',
  'ShieldCheck',
  'UserRoundCog',
  'Crown',
  'Star',
  'Briefcase',
  'Building2',
  'Headset',
  'Wrench',
  'Code',
  'PenTool',
  'Megaphone',
  'DollarSign',
  'Truck',
  'Phone',
  'Mail',
  'BarChart',
  'FileText',
  'Settings',
  'Lock',
  'Eye',
  'Key',
  'Database',
] as const;
