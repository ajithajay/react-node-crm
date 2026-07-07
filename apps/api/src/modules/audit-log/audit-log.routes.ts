import { Router } from 'express';
import { auditLogQuerySchema, PermissionFlagType } from '@saasly/shared';
import { authGuard } from '../../middleware/auth-guard.js';
import { workspaceGuard } from '../../middleware/workspace-guard.js';
import { permissionGuard } from '../../middleware/permission-guard.js';
import { validate } from '../../middleware/validate.js';
import { index } from './audit-log.controller.js';

export const auditLogRouter: Router = Router();

auditLogRouter.get(
  '/',
  authGuard,
  workspaceGuard,
  permissionGuard(PermissionFlagType.SECURITY),
  validate({ query: auditLogQuerySchema }),
  index,
);
