import { Router } from 'express';
import multer from 'multer';
import { authGuard } from '../../middleware/auth-guard.js';
import { workspaceGuard } from '../../middleware/workspace-guard.js';
import { remove, serve, upload } from './file.controller.js';

export const fileRouter: Router = Router();

const uploader = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// No authGuard: <img src> can't send an Authorization header. workspaceGuard + the
// workspaceId match inside getFile() are the access control for this low-sensitivity data.
fileRouter.get('/:id', workspaceGuard, serve);
fileRouter.post('/upload', authGuard, workspaceGuard, uploader.single('file'), upload);
fileRouter.delete('/:id', authGuard, workspaceGuard, remove);
