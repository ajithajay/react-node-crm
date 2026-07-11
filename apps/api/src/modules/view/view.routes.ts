import { Router } from 'express';
import {
  createViewRequestSchema,
  listViewsQuerySchema,
  setViewFieldsRequestSchema,
  setViewFiltersRequestSchema,
  setViewGroupsRequestSchema,
  setViewSortsRequestSchema,
  updateViewRequestSchema,
  PermissionFlagType,
} from '@saasly/shared';
import { authGuard } from '../../middleware/auth-guard.js';
import { workspaceGuard } from '../../middleware/workspace-guard.js';
import { permissionGuard } from '../../middleware/permission-guard.js';
import { validate } from '../../middleware/validate.js';
import * as viewController from './view.controller.js';

export const viewRouter: Router = Router();

const requireViewsPermission = permissionGuard(PermissionFlagType.VIEWS);

// Reading views is needed just to render an object's page — only mutations require the VIEWS flag.
viewRouter.get('/', authGuard, workspaceGuard, validate({ query: listViewsQuerySchema }), viewController.index);
viewRouter.get('/:id', authGuard, workspaceGuard, viewController.show);
viewRouter.post(
  '/',
  authGuard,
  workspaceGuard,
  requireViewsPermission,
  validate({ body: createViewRequestSchema }),
  viewController.create,
);
viewRouter.patch(
  '/:id',
  authGuard,
  workspaceGuard,
  requireViewsPermission,
  validate({ body: updateViewRequestSchema }),
  viewController.update,
);
viewRouter.delete('/:id', authGuard, workspaceGuard, requireViewsPermission, viewController.destroy);

viewRouter.put(
  '/:id/fields',
  authGuard,
  workspaceGuard,
  requireViewsPermission,
  validate({ body: setViewFieldsRequestSchema }),
  viewController.setFields,
);
viewRouter.put(
  '/:id/filters',
  authGuard,
  workspaceGuard,
  requireViewsPermission,
  validate({ body: setViewFiltersRequestSchema }),
  viewController.setFilters,
);
viewRouter.put(
  '/:id/sorts',
  authGuard,
  workspaceGuard,
  requireViewsPermission,
  validate({ body: setViewSortsRequestSchema }),
  viewController.setSorts,
);
viewRouter.put(
  '/:id/groups',
  authGuard,
  workspaceGuard,
  requireViewsPermission,
  validate({ body: setViewGroupsRequestSchema }),
  viewController.setGroups,
);
