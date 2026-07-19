import type { WorkspaceEntity, WorkspaceMemberEntity } from '@saasly/database';

declare global {
  namespace Express {
    interface Request {
      workspace?: WorkspaceEntity | null;
      workspaceId?: string | null;
      user?: { id: string } | null;
      userWorkspaceId?: string | null;
      /** Set instead of `user` when the request authenticates via an API-key bearer token (gap E3). */
      apiKey?: { id: string; roleId: string | null; name: string } | null;
      /** Set by workspaceGuard once it has verified `user` is a member of `workspace`. */
      workspaceMember?: WorkspaceMemberEntity | null;
    }
  }
}

export {};
