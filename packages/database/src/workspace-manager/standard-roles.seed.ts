import { StandardRoleName } from '@saasly/shared';

export interface StandardRoleDef {
  name: string;
  label: string;
  isEditable: boolean;
  canUpdateAllSettings: boolean;
  canReadAllObjectRecords: boolean;
  canUpdateAllObjectRecords: boolean;
  canSoftDeleteAllObjectRecords: boolean;
  canDestroyAllObjectRecords: boolean;
  canAccessAllTools: boolean;
}

/** Default roles seeded into every new workspace (BRD §8). */
export const STANDARD_ROLES: StandardRoleDef[] = [
  {
    name: StandardRoleName.ADMIN,
    label: 'Admin',
    isEditable: false,
    canUpdateAllSettings: true,
    canReadAllObjectRecords: true,
    canUpdateAllObjectRecords: true,
    canSoftDeleteAllObjectRecords: true,
    canDestroyAllObjectRecords: true,
    canAccessAllTools: true,
  },
  {
    name: StandardRoleName.MEMBER,
    label: 'Member',
    isEditable: true,
    canUpdateAllSettings: false,
    canReadAllObjectRecords: true,
    canUpdateAllObjectRecords: true,
    canSoftDeleteAllObjectRecords: true,
    canDestroyAllObjectRecords: false,
    canAccessAllTools: true,
  },
  {
    name: StandardRoleName.GUEST,
    label: 'Guest',
    isEditable: true,
    canUpdateAllSettings: false,
    canReadAllObjectRecords: true,
    canUpdateAllObjectRecords: false,
    canSoftDeleteAllObjectRecords: false,
    canDestroyAllObjectRecords: false,
    canAccessAllTools: false,
  },
];

/** The role newly-invited members receive by default. */
export const DEFAULT_ROLE_NAME = StandardRoleName.MEMBER;
