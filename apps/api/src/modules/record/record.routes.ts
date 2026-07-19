import { Router, type RequestHandler } from 'express';
import multer from 'multer';
import { PermissionFlagType, mergeRecordsRequestSchema, recordListQuerySchema } from '@saasly/shared';
import { authGuard, apiKeyGuard } from '../../middleware/auth-guard.js';
import { workspaceGuard } from '../../middleware/workspace-guard.js';
import { permissionGuard } from '../../middleware/permission-guard.js';
import { validate } from '../../middleware/validate.js';
import * as recordController from './record.controller.js';

/**
 * Generic record CRUD, metadata-driven: one router handles every object.
 * Object- and field-level permission checks happen inside record.service.ts (per-action, per-field),
 * not via the settings-only `permissionGuard` used elsewhere — that middleware only knows about
 * workspace settings flags, not the record-access tri-state model. CSV import/export are
 * the exception: they're additionally gated by the settings-level IMPORT_CSV/EXPORT_CSV flags
 * ("permission-gated"), on top of the same object/field checks every other record route enforces.
 */
export const recordRouter: Router = Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// Registered before `/:objectNamePlural/:id` so `/companies/export` doesn't get parsed as id="export".
recordRouter.get(
  '/:objectNamePlural/export',
  authGuard,
  workspaceGuard,
  permissionGuard(PermissionFlagType.EXPORT_CSV),
  validate({ query: recordListQuerySchema }),
  recordController.exportCsv,
);
recordRouter.post(
  '/:objectNamePlural/import',
  authGuard,
  workspaceGuard,
  permissionGuard(PermissionFlagType.IMPORT_CSV),
  upload.single('file'),
  recordController.importCsv,
);
recordRouter.post(
  '/:objectNamePlural/merge',
  authGuard,
  workspaceGuard,
  validate({ body: mergeRecordsRequestSchema }),
  recordController.merge,
);
recordRouter.get('/:objectNamePlural/:id/duplicates', authGuard, workspaceGuard, recordController.duplicates);

/**
 * Shared CRUD route table for both the internal (session, `/rest`) and external (API-key only,
 * `/api/v1`) surfaces — the controller/service layer already resolves the acting `Principal` from
 * either `req.user` or `req.apiKey`, so only the guard differs between the two mounts.
 */
function buildRecordCrudRouter(guard: RequestHandler): Router {
  const router = Router();
  router.get(
    '/:objectNamePlural',
    guard,
    workspaceGuard,
    validate({ query: recordListQuerySchema }),
    recordController.index,
  );
  router.get('/:objectNamePlural/:id', guard, workspaceGuard, recordController.show);
  router.post('/:objectNamePlural', guard, workspaceGuard, recordController.create);
  router.patch('/:objectNamePlural/:id', guard, workspaceGuard, recordController.update);
  router.delete('/:objectNamePlural/:id', guard, workspaceGuard, recordController.destroy);
  return router;
}

recordRouter.use(buildRecordCrudRouter(authGuard));

/** External REST API (v1) — API-key auth only, mounted separately at `/api/v1` (see app.ts). */
export const recordApiV1Router: Router = buildRecordCrudRouter(apiKeyGuard);
