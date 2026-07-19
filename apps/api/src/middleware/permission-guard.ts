import type { NextFunction, Request, Response } from 'express';
import { RolePermissionFlagEntity } from '@saasly/database';
import type { PermissionFlagType } from '@saasly/shared';
import { dataSource } from '../lib/db.js';
import { ForbiddenError } from '../lib/errors.js';
import { principalOf } from '../lib/principal.js';
import { resolveActorRole } from '../modules/record/record-permission.js';

/**
 * Requires the caller's role to either have `canUpdateAllSettings` (the Admin superset flag) or
 * hold the given fine-grained settings flag (BRD §8). Must run after `authGuard`/`apiKeyGuard` +
 * `workspaceGuard`. Resolves the role from `req.workspaceMember` for a session user or from
 * `req.apiKey.roleId` for an API key (falling back to the workspace default role), via the same
 * `resolveActorRole` the record engine uses — an API key is scoped by exactly the same
 * role/permission model as the member it stands in for.
 */
export function permissionGuard(flag: PermissionFlagType) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const { role } = await resolveActorRole(principalOf(req), req.workspaceId!);
      if (role.canUpdateAllSettings) {
        next();
        return;
      }

      const hasFlag = await dataSource.getRepository(RolePermissionFlagEntity).findOneBy({ roleId: role.id, flag });
      if (!hasFlag) {
        next(new ForbiddenError());
        return;
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
