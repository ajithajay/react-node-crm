import { Router } from 'express';
import { authGuard } from '../../middleware/auth-guard.js';
import { workspaceGuard } from '../../middleware/workspace-guard.js';
import { me } from './user.controller.js';

export const userRouter: Router = Router();

userRouter.get('/me', authGuard, workspaceGuard, me);
