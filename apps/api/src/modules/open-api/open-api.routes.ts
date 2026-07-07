import { Router } from 'express';
import { authGuard } from '../../middleware/auth-guard.js';
import { workspaceGuard } from '../../middleware/workspace-guard.js';
import * as openApiController from './open-api.controller.js';

export const openApiRouter: Router = Router();

openApiRouter.get('/:schema', authGuard, workspaceGuard, openApiController.getSpec);
