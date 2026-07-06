import { Router } from 'express';
import { authGuard } from '../../middleware/auth-guard.js';
import { workspaceGuard } from '../../middleware/workspace-guard.js';
import { index } from './role.controller.js';

export const roleRouter: Router = Router();

// List-only for now — Phase 5e adds create/edit/permissions/assignment on top of this.
roleRouter.get('/', authGuard, workspaceGuard, index);
