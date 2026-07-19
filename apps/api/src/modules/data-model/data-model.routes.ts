import { Router, type RequestHandler } from 'express';
import {
  createFieldRequestSchema,
  createIndexRequestSchema,
  createMorphRelationRequestSchema,
  createObjectRequestSchema,
  createRelationRequestSchema,
  setActiveRequestSchema,
  setFieldRecordPageVisibilityRequestSchema,
  savePageLayoutRequestSchema,
  setObjectIdentifiersRequestSchema,
  setSectionsRequestSchema,
  updateFieldRequestSchema,
  updateObjectRequestSchema,
  PermissionFlagType,
} from '@saasly/shared';
import { authGuard, apiKeyGuard } from '../../middleware/auth-guard.js';
import { workspaceGuard } from '../../middleware/workspace-guard.js';
import { permissionGuard } from '../../middleware/permission-guard.js';
import { validate } from '../../middleware/validate.js';
import * as dataModelController from './data-model.controller.js';

const requireDataModelPermission = permissionGuard(PermissionFlagType.DATA_MODEL);
const requireLayoutsPermission = permissionGuard(PermissionFlagType.LAYOUTS);

/**
 * Objects/fields/relations/indexes — the actual "data model" surface, exposed both internally
 * (`/data-model`, session auth) and externally (`/api/v1/objects`, API-key auth). Sections and
 * page-layout (record-page UI customization) are internal-only app concerns and stay off the v1
 * router entirely — see `buildInternalOnlyRoutes` below.
 */
function buildDataModelRouter(guard: RequestHandler): Router {
  const router = Router();

  router.get('/objects', guard, workspaceGuard, dataModelController.listObjects);
  router.get('/objects/:id', guard, workspaceGuard, dataModelController.getObject);
  router.post(
    '/objects',
    guard,
    workspaceGuard,
    requireDataModelPermission,
    validate({ body: createObjectRequestSchema }),
    dataModelController.createObject,
  );
  router.patch(
    '/objects/:id',
    guard,
    workspaceGuard,
    requireDataModelPermission,
    validate({ body: updateObjectRequestSchema }),
    dataModelController.updateObject,
  );
  router.patch(
    '/objects/:id/active',
    guard,
    workspaceGuard,
    requireDataModelPermission,
    validate({ body: setActiveRequestSchema }),
    dataModelController.setObjectActive,
  );
  router.delete('/objects/:id', guard, workspaceGuard, requireDataModelPermission, dataModelController.deleteObject);
  router.patch(
    '/objects/:id/identifiers',
    guard,
    workspaceGuard,
    requireDataModelPermission,
    validate({ body: setObjectIdentifiersRequestSchema }),
    dataModelController.setObjectIdentifiers,
  );

  router.post(
    '/objects/:id/fields',
    guard,
    workspaceGuard,
    requireDataModelPermission,
    validate({ body: createFieldRequestSchema }),
    dataModelController.createField,
  );
  router.patch(
    '/objects/:id/fields/:fieldId',
    guard,
    workspaceGuard,
    requireDataModelPermission,
    validate({ body: updateFieldRequestSchema }),
    dataModelController.updateField,
  );
  router.patch(
    '/objects/:id/fields/:fieldId/active',
    guard,
    workspaceGuard,
    requireDataModelPermission,
    validate({ body: setActiveRequestSchema }),
    dataModelController.setFieldActive,
  );
  router.delete(
    '/objects/:id/fields/:fieldId',
    guard,
    workspaceGuard,
    requireDataModelPermission,
    dataModelController.deleteField,
  );

  router.post(
    '/objects/:id/relations',
    guard,
    workspaceGuard,
    requireDataModelPermission,
    validate({ body: createRelationRequestSchema }),
    dataModelController.createRelation,
  );
  router.post(
    '/objects/:id/morph-relations',
    guard,
    workspaceGuard,
    requireDataModelPermission,
    validate({ body: createMorphRelationRequestSchema }),
    dataModelController.createMorphRelation,
  );

  router.post(
    '/objects/:id/indexes',
    guard,
    workspaceGuard,
    requireDataModelPermission,
    validate({ body: createIndexRequestSchema }),
    dataModelController.createIndex,
  );
  router.delete(
    '/objects/:id/indexes/:indexId',
    guard,
    workspaceGuard,
    requireDataModelPermission,
    dataModelController.deleteIndex,
  );

  return router;
}

export const dataModelRouter: Router = buildDataModelRouter(authGuard);

/** External REST API (v1) — API-key auth, scoped by the key's assigned role. */
export const dataModelApiV1Router: Router = buildDataModelRouter(apiKeyGuard);

// ---- Internal-only: record-page UI customization (sections + page layout), never exposed on v1 ----

dataModelRouter.patch(
  '/objects/:id/fields/:fieldId/record-page-visibility',
  authGuard,
  workspaceGuard,
  requireDataModelPermission,
  validate({ body: setFieldRecordPageVisibilityRequestSchema }),
  dataModelController.setFieldRecordPageVisibility,
);

dataModelRouter.get('/objects/:id/sections', authGuard, workspaceGuard, dataModelController.listSections);
dataModelRouter.put(
  '/objects/:id/sections',
  authGuard,
  workspaceGuard,
  requireDataModelPermission,
  validate({ body: setSectionsRequestSchema }),
  dataModelController.setSections,
);

// Full record-page layout (Settings → Layout customization). Reads open to any member; writes gated by LAYOUTS.
dataModelRouter.get('/objects/:id/page-layout', authGuard, workspaceGuard, dataModelController.getPageLayout);
dataModelRouter.put(
  '/objects/:id/page-layout',
  authGuard,
  workspaceGuard,
  requireLayoutsPermission,
  validate({ body: savePageLayoutRequestSchema }),
  dataModelController.savePageLayout,
);
dataModelRouter.post(
  '/objects/:id/page-layout/reset',
  authGuard,
  workspaceGuard,
  requireLayoutsPermission,
  dataModelController.resetPageLayout,
);
dataModelRouter.post(
  '/objects/:id/page-layout/widgets/:widgetId/reset',
  authGuard,
  workspaceGuard,
  requireLayoutsPermission,
  dataModelController.resetPageLayoutWidget,
);
