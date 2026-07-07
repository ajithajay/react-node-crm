import { Router } from 'express';
import { createWebhookRequestSchema, updateWebhookRequestSchema, PermissionFlagType } from '@saasly/shared';
import { authGuard } from '../../middleware/auth-guard.js';
import { workspaceGuard } from '../../middleware/workspace-guard.js';
import { permissionGuard } from '../../middleware/permission-guard.js';
import { validate } from '../../middleware/validate.js';
import * as webhookController from './webhook.controller.js';

export const webhookRouter: Router = Router();

const requireApiPermission = permissionGuard(PermissionFlagType.API_KEYS_AND_WEBHOOKS);

webhookRouter.get('/', authGuard, workspaceGuard, requireApiPermission, webhookController.index);
webhookRouter.post(
  '/',
  authGuard,
  workspaceGuard,
  requireApiPermission,
  validate({ body: createWebhookRequestSchema }),
  webhookController.create,
);
webhookRouter.patch(
  '/:id',
  authGuard,
  workspaceGuard,
  requireApiPermission,
  validate({ body: updateWebhookRequestSchema }),
  webhookController.update,
);
webhookRouter.post(
  '/:id/regenerate-secret',
  authGuard,
  workspaceGuard,
  requireApiPermission,
  webhookController.regenerateSecret,
);
webhookRouter.delete('/:id', authGuard, workspaceGuard, requireApiPermission, webhookController.destroy);
