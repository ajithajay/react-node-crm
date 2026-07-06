import { RoleEntity } from '@saasly/database';
import { dataSource } from '../../lib/db.js';

export interface RoleSummary {
  id: string;
  name: string;
  label: string;
  isEditable: boolean;
}

export async function listRoles(workspaceId: string): Promise<RoleSummary[]> {
  const roles = await dataSource.getRepository(RoleEntity).findBy({ workspaceId });
  return roles.map((role) => ({ id: role.id, name: role.name, label: role.label, isEditable: role.isEditable }));
}
