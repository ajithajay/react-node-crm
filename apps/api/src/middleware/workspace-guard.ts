import type { NextFunction, Request, Response } from 'express';
import { WorkspaceMemberEntity } from '@saasly/database';
import { dataSource } from '../lib/db.js';
import { ForbiddenError, NotFoundError } from '../lib/errors.js';

/**
 * Confirms the resolved workspace exists, and — whenever a JWT-authenticated user is present —
 * that they are actually a member of it. `req.workspace`/`req.workspaceId` are resolved from the
 * Host header subdomain and `req.user` is resolved from the bearer token independently of each
 * other (see request-context.ts); this is the single place that ties the two together, so no
 * route can forget to check membership. Skipped for API-key auth (`req.apiKey`), which already
 * enforces `apiKey.workspaceId === req.workspaceId` in `resolveApiKey`, and for pre-auth routes
 * (e.g. login) where neither `req.user` nor `req.apiKey` is set yet.
 */
export async function workspaceGuard(req: Request, _res: Response, next: NextFunction): Promise<void> {
  if (!req.workspace) {
    next(new NotFoundError('Workspace not found'));
    return;
  }
  if (req.user) {
    try {
      const member = await dataSource
        .getRepository(WorkspaceMemberEntity)
        .findOneBy({ userId: req.user.id, workspaceId: req.workspaceId! });
      if (!member) {
        next(new ForbiddenError('Not a member of this workspace'));
        return;
      }
      req.workspaceMember = member;
    } catch (err) {
      next(err);
      return;
    }
  }
  next();
}
