import { Router } from 'express';
import { createInvitationRequestSchema, acceptInvitationRequestSchema, PermissionFlagType } from '@saasly/shared';
import { authGuard } from '../../middleware/auth-guard.js';
import { workspaceGuard } from '../../middleware/workspace-guard.js';
import { permissionGuard } from '../../middleware/permission-guard.js';
import { validate } from '../../middleware/validate.js';
import * as invitationController from './invitation.controller.js';

/** Workspace-admin actions — mounted at /members/invitations. */
export const invitationAdminRouter: Router = Router();

const requireMembersPermission = permissionGuard(PermissionFlagType.WORKSPACE_MEMBERS);

invitationAdminRouter.get('/', authGuard, workspaceGuard, invitationController.index);
invitationAdminRouter.post(
  '/',
  authGuard,
  workspaceGuard,
  requireMembersPermission,
  validate({ body: createInvitationRequestSchema }),
  invitationController.create,
);
invitationAdminRouter.post(
  '/:id/resend',
  authGuard,
  workspaceGuard,
  requireMembersPermission,
  invitationController.resend,
);
invitationAdminRouter.delete(
  '/:id',
  authGuard,
  workspaceGuard,
  requireMembersPermission,
  invitationController.revoke,
);

/** Public accept flow — mounted at /invitations. No workspace is known yet at this point. */
export const invitationPublicRouter: Router = Router();

invitationPublicRouter.get('/:token', invitationController.preview);
invitationPublicRouter.post(
  '/:token/accept',
  validate({ body: acceptInvitationRequestSchema }),
  invitationController.accept,
);
