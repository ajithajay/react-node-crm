import { Router } from 'express';
import multer from 'multer';
import { updateProfileRequestSchema, changePasswordRequestSchema, deleteAccountRequestSchema } from '@saasly/shared';
import { authGuard } from '../../middleware/auth-guard.js';
import { workspaceGuard } from '../../middleware/workspace-guard.js';
import { validate } from '../../middleware/validate.js';
import * as userController from './user.controller.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

export const userRouter: Router = Router();

userRouter.get('/me', authGuard, workspaceGuard, userController.me);
userRouter.patch(
  '/me',
  authGuard,
  workspaceGuard,
  validate({ body: updateProfileRequestSchema }),
  userController.updateMe,
);
userRouter.post('/me/avatar', authGuard, workspaceGuard, upload.single('file'), userController.uploadAvatar);
userRouter.delete('/me/avatar', authGuard, workspaceGuard, userController.removeAvatar);
userRouter.post(
  '/me/password',
  authGuard,
  workspaceGuard,
  validate({ body: changePasswordRequestSchema }),
  userController.changePassword,
);
userRouter.delete(
  '/me',
  authGuard,
  workspaceGuard,
  validate({ body: deleteAccountRequestSchema }),
  userController.deleteAccount,
);
