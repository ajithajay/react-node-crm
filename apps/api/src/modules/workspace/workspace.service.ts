import { WorkspaceEntity } from '@saasly/database';
import { dataSource } from '../../lib/db.js';

export interface CurrentWorkspaceResponse {
  id: string;
  name: string;
  subdomain: string;
  logoUrl: string | null;
}

export async function getCurrentWorkspace(workspaceId: string): Promise<CurrentWorkspaceResponse> {
  const workspace = await dataSource.getRepository(WorkspaceEntity).findOneByOrFail({ id: workspaceId });
  return { id: workspace.id, name: workspace.name, subdomain: workspace.subdomain, logoUrl: workspace.logoUrl };
}
