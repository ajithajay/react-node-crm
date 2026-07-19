import { Router, type RequestHandler } from 'express';
import { reassignMemberRoleRequestSchema, PermissionFlagType } from '@saasly/shared';
import { authGuard, apiKeyGuard } from '../../middleware/auth-guard.js';
import { workspaceGuard } from '../../middleware/workspace-guard.js';
import { permissionGuard } from '../../middleware/permission-guard.js';
import { validate } from '../../middleware/validate.js';
import { list, updateRole } from './member.controller.js';

const requireMembersPermission = permissionGuard(PermissionFlagType.WORKSPACE_MEMBERS);

function buildMemberRouter(guard: RequestHandler): Router {
  const router = Router();
  router.get('/', guard, workspaceGuard, list);
  router.patch(
    '/:id/role',
    guard,
    workspaceGuard,
    requireMembersPermission,
    validate({ body: reassignMemberRoleRequestSchema }),
    updateRole,
  );
  return router;
}

export const memberRouter: Router = buildMemberRouter(authGuard);

/** External REST API (v1) — API-key auth, scoped by the key's assigned role. */
export const memberApiV1Router: Router = buildMemberRouter(apiKeyGuard);
