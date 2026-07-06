import type { NextFunction, Request, Response } from 'express';
import { TokenType, extractSubdomain } from '@saasly/shared';
import { WorkspaceEntity } from '@saasly/database';
import { env } from '../lib/config.js';
import { dataSource } from '../lib/db.js';
import { verifyToken } from '../lib/jwt.js';

/**
 * Resolves subdomain → workspace and Authorization bearer → user, attaching both to `req`.
 * Never rejects the request itself — `authGuard`/`workspaceGuard` decide what's required per route.
 */
export async function requestContext(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const subdomain = extractSubdomain(req.headers.host, env.APP_BASE_DOMAIN);
    if (subdomain) {
      req.workspace = await dataSource.getRepository(WorkspaceEntity).findOneBy({ subdomain });
      req.workspaceId = req.workspace?.id ?? null;
    } else {
      req.workspace = null;
      req.workspaceId = null;
    }

    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice('Bearer '.length);
      try {
        const payload = verifyToken(token, TokenType.ACCESS);
        req.user = { id: payload.sub };
        req.userWorkspaceId = payload.userWorkspaceId ?? null;
      } catch {
        // Invalid/expired access token — leave req.user unset; authGuard rejects if required.
      }
    }

    next();
  } catch (err) {
    next(err);
  }
}
