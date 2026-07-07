import { Router } from 'express';
import { reassignMemberRoleRequestSchema, PermissionFlagType } from '@saasly/shared';
import { authGuard } from '../../middleware/auth-guard.js';
import { workspaceGuard } from '../../middleware/workspace-guard.js';
import { permissionGuard } from '../../middleware/permission-guard.js';
import { validate } from '../../middleware/validate.js';
import { list, updateRole } from './member.controller.js';

export const memberRouter: Router = Router();

memberRouter.get('/', authGuard, workspaceGuard, list);
memberRouter.patch(
  '/:id/role',
  authGuard,
  workspaceGuard,
  permissionGuard(PermissionFlagType.WORKSPACE_MEMBERS),
  validate({ body: reassignMemberRoleRequestSchema }),
  updateRole,
);
