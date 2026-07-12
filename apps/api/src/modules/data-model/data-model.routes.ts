import { Router } from 'express';
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
import { authGuard } from '../../middleware/auth-guard.js';
import { workspaceGuard } from '../../middleware/workspace-guard.js';
import { permissionGuard } from '../../middleware/permission-guard.js';
import { validate } from '../../middleware/validate.js';
import * as dataModelController from './data-model.controller.js';

export const dataModelRouter: Router = Router();

const requireDataModelPermission = permissionGuard(PermissionFlagType.DATA_MODEL);
const requireLayoutsPermission = permissionGuard(PermissionFlagType.LAYOUTS);

dataModelRouter.get('/objects', authGuard, workspaceGuard, dataModelController.listObjects);
dataModelRouter.get('/objects/:id', authGuard, workspaceGuard, dataModelController.getObject);
dataModelRouter.post(
  '/objects',
  authGuard,
  workspaceGuard,
  requireDataModelPermission,
  validate({ body: createObjectRequestSchema }),
  dataModelController.createObject,
);
dataModelRouter.patch(
  '/objects/:id',
  authGuard,
  workspaceGuard,
  requireDataModelPermission,
  validate({ body: updateObjectRequestSchema }),
  dataModelController.updateObject,
);
dataModelRouter.patch(
  '/objects/:id/active',
  authGuard,
  workspaceGuard,
  requireDataModelPermission,
  validate({ body: setActiveRequestSchema }),
  dataModelController.setObjectActive,
);
dataModelRouter.delete('/objects/:id', authGuard, workspaceGuard, requireDataModelPermission, dataModelController.deleteObject);
dataModelRouter.patch(
  '/objects/:id/identifiers',
  authGuard,
  workspaceGuard,
  requireDataModelPermission,
  validate({ body: setObjectIdentifiersRequestSchema }),
  dataModelController.setObjectIdentifiers,
);

dataModelRouter.post(
  '/objects/:id/fields',
  authGuard,
  workspaceGuard,
  requireDataModelPermission,
  validate({ body: createFieldRequestSchema }),
  dataModelController.createField,
);
dataModelRouter.patch(
  '/objects/:id/fields/:fieldId',
  authGuard,
  workspaceGuard,
  requireDataModelPermission,
  validate({ body: updateFieldRequestSchema }),
  dataModelController.updateField,
);
dataModelRouter.patch(
  '/objects/:id/fields/:fieldId/active',
  authGuard,
  workspaceGuard,
  requireDataModelPermission,
  validate({ body: setActiveRequestSchema }),
  dataModelController.setFieldActive,
);
dataModelRouter.patch(
  '/objects/:id/fields/:fieldId/record-page-visibility',
  authGuard,
  workspaceGuard,
  requireDataModelPermission,
  validate({ body: setFieldRecordPageVisibilityRequestSchema }),
  dataModelController.setFieldRecordPageVisibility,
);
dataModelRouter.delete(
  '/objects/:id/fields/:fieldId',
  authGuard,
  workspaceGuard,
  requireDataModelPermission,
  dataModelController.deleteField,
);

dataModelRouter.post(
  '/objects/:id/relations',
  authGuard,
  workspaceGuard,
  requireDataModelPermission,
  validate({ body: createRelationRequestSchema }),
  dataModelController.createRelation,
);
dataModelRouter.post(
  '/objects/:id/morph-relations',
  authGuard,
  workspaceGuard,
  requireDataModelPermission,
  validate({ body: createMorphRelationRequestSchema }),
  dataModelController.createMorphRelation,
);

dataModelRouter.post(
  '/objects/:id/indexes',
  authGuard,
  workspaceGuard,
  requireDataModelPermission,
  validate({ body: createIndexRequestSchema }),
  dataModelController.createIndex,
);
dataModelRouter.delete(
  '/objects/:id/indexes/:indexId',
  authGuard,
  workspaceGuard,
  requireDataModelPermission,
  dataModelController.deleteIndex,
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
