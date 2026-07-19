import { Router, type RequestHandler } from 'express';
import multer from 'multer';
import { authGuard, apiKeyGuard } from '../../middleware/auth-guard.js';
import { workspaceGuard } from '../../middleware/workspace-guard.js';
import { remove, serve, upload } from './file.controller.js';

const uploader = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

export const fileRouter: Router = Router();

// No authGuard: <img src> can't send an Authorization header. workspaceGuard + the
// workspaceId match inside getFile() are the access control for this low-sensitivity data.
fileRouter.get('/:id', workspaceGuard, serve);
fileRouter.post('/upload', authGuard, workspaceGuard, uploader.single('file'), upload);
fileRouter.delete('/:id', authGuard, workspaceGuard, remove);

/** External REST API (v1) — API-key auth. Upload/delete have no per-user ownership check today. */
function buildFileApiV1Router(guard: RequestHandler): Router {
  const router = Router();
  router.get('/:id', workspaceGuard, serve);
  router.post('/upload', guard, workspaceGuard, uploader.single('file'), upload);
  router.delete('/:id', guard, workspaceGuard, remove);
  return router;
}

export const fileApiV1Router: Router = buildFileApiV1Router(apiKeyGuard);
