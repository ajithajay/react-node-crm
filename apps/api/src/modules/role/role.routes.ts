import { Router } from 'express';
import {
  createRoleRequestSchema,
  updateRoleRequestSchema,
  updateSettingsPermissionsRequestSchema,
  updateObjectPermissionRequestSchema,
  updateFieldPermissionRequestSchema,
  PermissionFlagType,
} from '@saasly/shared';
import { authGuard } from '../../middleware/auth-guard.js';
import { workspaceGuard } from '../../middleware/workspace-guard.js';
import { permissionGuard } from '../../middleware/permission-guard.js';
import { validate } from '../../middleware/validate.js';
import * as roleController from './role.controller.js';

export const roleRouter: Router = Router();

const requireRolesPermission = permissionGuard(PermissionFlagType.ROLES);

// Listing roles / a role's detail is needed just to populate selectors (Default Role, Invite,
// Assignment) — read access doesn't require the ROLES settings flag, only mutations do.
roleRouter.get('/', authGuard, workspaceGuard, roleController.index);
roleRouter.get('/:id', authGuard, workspaceGuard, roleController.show);
roleRouter.post(
  '/',
  authGuard,
  workspaceGuard,
  requireRolesPermission,
  validate({ body: createRoleRequestSchema }),
  roleController.create,
);
roleRouter.patch(
  '/:id',
  authGuard,
  workspaceGuard,
  requireRolesPermission,
  validate({ body: updateRoleRequestSchema }),
  roleController.update,
);
roleRouter.delete('/:id', authGuard, workspaceGuard, requireRolesPermission, roleController.destroy);

roleRouter.get('/:id/settings-permissions', authGuard, workspaceGuard, roleController.getSettingsPermissions);
roleRouter.put(
  '/:id/settings-permissions',
  authGuard,
  workspaceGuard,
  requireRolesPermission,
  validate({ body: updateSettingsPermissionsRequestSchema }),
  roleController.updateSettingsPermissions,
);

roleRouter.get('/:id/object-permissions', authGuard, workspaceGuard, roleController.listObjectPermissions);
roleRouter.put(
  '/:id/object-permissions/:objectMetadataId',
  authGuard,
  workspaceGuard,
  requireRolesPermission,
  validate({ body: updateObjectPermissionRequestSchema }),
  roleController.updateObjectPermission,
);

roleRouter.delete(
  '/:id/object-permissions/:objectMetadataId',
  authGuard,
  workspaceGuard,
  requireRolesPermission,
  roleController.removeObjectPermission,
);

roleRouter.get(
  '/:id/objects/:objectMetadataId/field-permissions',
  authGuard,
  workspaceGuard,
  roleController.listFieldPermissions,
);
roleRouter.put(
  '/:id/field-permissions/:fieldMetadataId',
  authGuard,
  workspaceGuard,
  requireRolesPermission,
  validate({ body: updateFieldPermissionRequestSchema }),
  roleController.updateFieldPermission,
);

roleRouter.get('/:id/members', authGuard, workspaceGuard, roleController.listRoleMembers);
