import { Router } from 'express';
import multer from 'multer';
import { updateWorkspaceRequestSchema, setDefaultRoleRequestSchema, PermissionFlagType } from '@saasly/shared';
import { authGuard } from '../../middleware/auth-guard.js';
import { workspaceGuard } from '../../middleware/workspace-guard.js';
import { permissionGuard } from '../../middleware/permission-guard.js';
import { validate } from '../../middleware/validate.js';
import * as workspaceController from './workspace.controller.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
const requireWorkspacePermission = permissionGuard(PermissionFlagType.WORKSPACE);

export const workspaceRouter: Router = Router();

workspaceRouter.get('/', authGuard, workspaceGuard, workspaceController.current);
workspaceRouter.patch(
  '/',
  authGuard,
  workspaceGuard,
  requireWorkspacePermission,
  validate({ body: updateWorkspaceRequestSchema }),
  workspaceController.update,
);
workspaceRouter.post(
  '/logo',
  authGuard,
  workspaceGuard,
  requireWorkspacePermission,
  upload.single('file'),
  workspaceController.uploadLogo,
);
workspaceRouter.delete('/logo', authGuard, workspaceGuard, requireWorkspacePermission, workspaceController.removeLogo);
workspaceRouter.patch(
  '/default-role',
  authGuard,
  workspaceGuard,
  requireWorkspacePermission,
  validate({ body: setDefaultRoleRequestSchema }),
  workspaceController.setDefaultRole,
);
workspaceRouter.delete('/', authGuard, workspaceGuard, requireWorkspacePermission, workspaceController.remove);
