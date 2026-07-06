import type { WorkspaceEntity } from '@saasly/database';

declare global {
  namespace Express {
    interface Request {
      workspace?: WorkspaceEntity | null;
      workspaceId?: string | null;
      user?: { id: string } | null;
      userWorkspaceId?: string | null;
    }
  }
}

export {};
