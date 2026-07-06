import { Router } from 'express';
import { authGuard } from '../../middleware/auth-guard.js';
import { workspaceGuard } from '../../middleware/workspace-guard.js';
import { current } from './workspace.controller.js';

export const workspaceRouter: Router = Router();

workspaceRouter.get('/', authGuard, workspaceGuard, current);
