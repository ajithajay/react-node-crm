import { Router } from 'express';
import { workspaceGuard } from '../../middleware/workspace-guard.js';
import { serve } from './file.controller.js';

export const fileRouter: Router = Router();

// No authGuard: <img src> can't send an Authorization header. workspaceGuard + the
// workspaceId match inside getFile() are the access control for this low-sensitivity data.
fileRouter.get('/:id', workspaceGuard, serve);
