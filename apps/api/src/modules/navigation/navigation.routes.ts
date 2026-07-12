import { Router } from 'express';
import { createNavigationMenuItemSchema, updateNavigationMenuItemSchema } from '@saasly/shared';
import { authGuard } from '../../middleware/auth-guard.js';
import { workspaceGuard } from '../../middleware/workspace-guard.js';
import { validate } from '../../middleware/validate.js';
import * as navigationController from './navigation.controller.js';

/** Per-member sidebar customization (folders + menu items) — no settings permission flag; it's the
 * member's own navigation, not a workspace-wide setting (gap F1). */
export const navigationRouter: Router = Router();

navigationRouter.get('/', authGuard, workspaceGuard, navigationController.list);
navigationRouter.post(
  '/',
  authGuard,
  workspaceGuard,
  validate({ body: createNavigationMenuItemSchema }),
  navigationController.create,
);
navigationRouter.patch(
  '/:id',
  authGuard,
  workspaceGuard,
  validate({ body: updateNavigationMenuItemSchema }),
  navigationController.update,
);
navigationRouter.delete('/:id', authGuard, workspaceGuard, navigationController.remove);
