import { Router, type RequestHandler } from 'express';
import { createInvitationRequestSchema, acceptInvitationRequestSchema, PermissionFlagType } from '@saasly/shared';
import { authGuard, apiKeyGuard } from '../../middleware/auth-guard.js';
import { workspaceGuard } from '../../middleware/workspace-guard.js';
import { permissionGuard } from '../../middleware/permission-guard.js';
import { validate } from '../../middleware/validate.js';
import * as invitationController from './invitation.controller.js';

const requireMembersPermission = permissionGuard(PermissionFlagType.WORKSPACE_MEMBERS);

function buildInvitationAdminRouter(guard: RequestHandler): Router {
  const router = Router();
  router.get('/', guard, workspaceGuard, invitationController.index);
  router.post(
    '/',
    guard,
    workspaceGuard,
    requireMembersPermission,
    validate({ body: createInvitationRequestSchema }),
    invitationController.create,
  );
  router.post('/:id/resend', guard, workspaceGuard, requireMembersPermission, invitationController.resend);
  router.delete('/:id', guard, workspaceGuard, requireMembersPermission, invitationController.revoke);
  return router;
}

/** Workspace-admin actions — mounted at /members/invitations. */
export const invitationAdminRouter: Router = buildInvitationAdminRouter(authGuard);

/** External REST API (v1) — API-key auth, scoped by the key's assigned role. */
export const invitationApiV1Router: Router = buildInvitationAdminRouter(apiKeyGuard);

/** Public accept flow — mounted at /invitations. No workspace is known yet at this point. */
export const invitationPublicRouter: Router = Router();

invitationPublicRouter.get('/:token', invitationController.preview);
invitationPublicRouter.post(
  '/:token/accept',
  validate({ body: acceptInvitationRequestSchema }),
  invitationController.accept,
);
