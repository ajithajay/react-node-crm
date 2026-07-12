import type { NextFunction, Request, Response } from 'express';
import { createHash } from 'node:crypto';
import { TokenType, extractSubdomain } from '@saasly/shared';
import { ApiKeyEntity, WorkspaceEntity } from '@saasly/database';
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
        // Not an access token — try an API-key bearer token (gap E3).
        await resolveApiKey(req, token);
      }
    }

    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Authenticates an API-key bearer token: verifies the signed JWT, confirms the persisted key by its
 * hash is neither revoked nor expired, and that it belongs to the Host-resolved workspace. Sets
 * `req.apiKey` (no `req.user` — an API key has no member).
 */
async function resolveApiKey(req: Request, token: string): Promise<void> {
  let payload;
  try {
    payload = verifyToken(token, TokenType.API_KEY);
  } catch {
    return; // neither an access nor an API-key token — leave unauthenticated
  }
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const apiKey = await dataSource.getRepository(ApiKeyEntity).findOneBy({ id: payload.sub, tokenHash });
  if (!apiKey) return;
  if (apiKey.revokedAt) return;
  if (apiKey.expiresAt && apiKey.expiresAt.getTime() < Date.now()) return;
  // The key must be used against its own workspace (resolved from the request Host).
  if (!req.workspaceId || apiKey.workspaceId !== req.workspaceId) return;
  req.apiKey = { id: apiKey.id, roleId: apiKey.roleId, name: apiKey.name };
}
