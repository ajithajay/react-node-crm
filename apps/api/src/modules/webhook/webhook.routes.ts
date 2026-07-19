import { Router, type RequestHandler } from 'express';
import { createWebhookRequestSchema, updateWebhookRequestSchema, PermissionFlagType } from '@saasly/shared';
import { authGuard, apiKeyGuard } from '../../middleware/auth-guard.js';
import { workspaceGuard } from '../../middleware/workspace-guard.js';
import { permissionGuard } from '../../middleware/permission-guard.js';
import { validate } from '../../middleware/validate.js';
import * as webhookController from './webhook.controller.js';

const requireApiPermission = permissionGuard(PermissionFlagType.API_KEYS_AND_WEBHOOKS);

function buildWebhookRouter(guard: RequestHandler): Router {
  const router = Router();
  router.get('/', guard, workspaceGuard, requireApiPermission, webhookController.index);
  router.post(
    '/',
    guard,
    workspaceGuard,
    requireApiPermission,
    validate({ body: createWebhookRequestSchema }),
    webhookController.create,
  );
  router.patch(
    '/:id',
    guard,
    workspaceGuard,
    requireApiPermission,
    validate({ body: updateWebhookRequestSchema }),
    webhookController.update,
  );
  router.post('/:id/regenerate-secret', guard, workspaceGuard, requireApiPermission, webhookController.regenerateSecret);
  router.delete('/:id', guard, workspaceGuard, requireApiPermission, webhookController.destroy);
  return router;
}

export const webhookRouter: Router = buildWebhookRouter(authGuard);

/** External REST API (v1) — API-key auth, scoped by the key's assigned role. */
export const webhookApiV1Router: Router = buildWebhookRouter(apiKeyGuard);
