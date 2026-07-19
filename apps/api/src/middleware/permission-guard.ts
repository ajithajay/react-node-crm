import type { NextFunction, Request, Response } from 'express';
import { RoleEntity, RolePermissionFlagEntity } from '@saasly/database';
import type { PermissionFlagType } from '@saasly/shared';
import { dataSource } from '../lib/db.js';
import { ForbiddenError } from '../lib/errors.js';

/**
 * Requires the caller's role to either have `canUpdateAllSettings` (the Admin superset flag) or
 * hold the given fine-grained settings flag (BRD §8). Must run after authGuard + workspaceGuard
 * (which populates `req.workspaceMember`).
 */
export function permissionGuard(flag: PermissionFlagType) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const member = req.workspaceMember;
      if (!member?.roleId) {
        next(new ForbiddenError());
        return;
      }

      const role = await dataSource.getRepository(RoleEntity).findOneBy({ id: member.roleId });
      if (!role) {
        next(new ForbiddenError());
        return;
      }
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
