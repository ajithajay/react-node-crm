import { Router } from 'express';
import multer from 'multer';
import { updateWorkspaceRequestSchema, setDefaultRoleRequestSchema } from '@saasly/shared';
import { authGuard } from '../../middleware/auth-guard.js';
import { workspaceGuard } from '../../middleware/workspace-guard.js';
import { validate } from '../../middleware/validate.js';
import * as workspaceController from './workspace.controller.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

export const workspaceRouter: Router = Router();

workspaceRouter.get('/', authGuard, workspaceGuard, workspaceController.current);
workspaceRouter.patch(
  '/',
  authGuard,
  workspaceGuard,
  validate({ body: updateWorkspaceRequestSchema }),
  workspaceController.update,
);
workspaceRouter.post(
  '/logo',
  authGuard,
  workspaceGuard,
  upload.single('file'),
  workspaceController.uploadLogo,
);
workspaceRouter.delete('/logo', authGuard, workspaceGuard, workspaceController.removeLogo);
workspaceRouter.patch(
  '/default-role',
  authGuard,
  workspaceGuard,
  validate({ body: setDefaultRoleRequestSchema }),
  workspaceController.setDefaultRole,
);
