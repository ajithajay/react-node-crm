import { Router } from 'express';
import { createApiKeyRequestSchema, PermissionFlagType } from '@saasly/shared';
import { authGuard } from '../../middleware/auth-guard.js';
import { workspaceGuard } from '../../middleware/workspace-guard.js';
import { permissionGuard } from '../../middleware/permission-guard.js';
import { validate } from '../../middleware/validate.js';
import * as apiKeyController from './api-key.controller.js';

export const apiKeyRouter: Router = Router();

const requireApiPermission = permissionGuard(PermissionFlagType.API_KEYS_AND_WEBHOOKS);

apiKeyRouter.get('/', authGuard, workspaceGuard, requireApiPermission, apiKeyController.index);
apiKeyRouter.post(
  '/',
  authGuard,
  workspaceGuard,
  requireApiPermission,
  validate({ body: createApiKeyRequestSchema }),
  apiKeyController.create,
);
apiKeyRouter.delete('/:id', authGuard, workspaceGuard, requireApiPermission, apiKeyController.revoke);
