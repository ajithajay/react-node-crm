export interface SettingsNavGroup {
  label: string;
  items: { label: string; path: string }[];
}

/** Settings shell groups (solution-approach.md §6-7). "Other" is empty in v1 — nothing there is in scope. */
export const SETTINGS_NAV: SettingsNavGroup[] = [
  {
    label: 'User',
    items: [
      { label: 'Profile', path: '/settings/profile' },
      { label: 'Experience', path: '/settings/experience' },
    ],
  },
  {
    label: 'Workspace',
    items: [
      { label: 'General', path: '/settings/general' },
      { label: 'Layout', path: '/settings/layout' },
      { label: 'Members', path: '/settings/members' },
      { label: 'Roles', path: '/settings/roles' },
      { label: 'API & Webhooks', path: '/settings/api' },
      { label: 'Data Model', path: '/settings/objects' },
    ],
  },
];
