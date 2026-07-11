import { Router } from 'express';
import multer from 'multer';
import { PermissionFlagType, recordListQuerySchema } from '@saasly/shared';
import { authGuard } from '../../middleware/auth-guard.js';
import { workspaceGuard } from '../../middleware/workspace-guard.js';
import { permissionGuard } from '../../middleware/permission-guard.js';
import { validate } from '../../middleware/validate.js';
import * as recordController from './record.controller.js';

/**
 * Generic record CRUD, metadata-driven (solution-approach.md §5): one router handles every object.
 * Object- and field-level permission checks happen inside record.service.ts (per-action, per-field),
 * not via the settings-only `permissionGuard` used elsewhere — that middleware only knows about
 * workspace settings flags, not the record-access tri-state model (Phase 5e). CSV import/export are
 * the exception: they're additionally gated by the settings-level IMPORT_CSV/EXPORT_CSV flags (BRD
 * §4 "permission-gated"), on top of the same object/field checks every other record route enforces.
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

recordRouter.get(
  '/:objectNamePlural',
  authGuard,
  workspaceGuard,
  validate({ query: recordListQuerySchema }),
  recordController.index,
);
recordRouter.get('/:objectNamePlural/:id', authGuard, workspaceGuard, recordController.show);
recordRouter.post('/:objectNamePlural', authGuard, workspaceGuard, recordController.create);
recordRouter.patch('/:objectNamePlural/:id', authGuard, workspaceGuard, recordController.update);
recordRouter.delete('/:objectNamePlural/:id', authGuard, workspaceGuard, recordController.destroy);
