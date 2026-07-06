import { Router } from 'express';
import { authGuard } from '../../middleware/auth-guard.js';
import { workspaceGuard } from '../../middleware/workspace-guard.js';
import { list } from './member.controller.js';

export const memberRouter: Router = Router();

memberRouter.get('/', authGuard, workspaceGuard, list);
