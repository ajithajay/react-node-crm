import type { WorkspaceEntity } from '@saasly/database';

declare global {
  namespace Express {
    interface Request {
      workspace?: WorkspaceEntity | null;
      workspaceId?: string | null;
      user?: { id: string } | null;
      userWorkspaceId?: string | null;
      /** Set instead of `user` when the request authenticates via an API-key bearer token (gap E3). */
      apiKey?: { id: string; roleId: string | null; name: string } | null;
    }
  }
}

export {};
