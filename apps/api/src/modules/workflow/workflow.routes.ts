import { Router } from 'express';
import {
  createWorkflowRequestSchema,
  runWorkflowRequestSchema,
  updateWorkflowRequestSchema,
  updateWorkflowVersionRequestSchema,
  workflowRunnableQuerySchema,
  workflowRunQuerySchema,
  PermissionFlagType,
} from '@saasly/shared';
import { authGuard } from '../../middleware/auth-guard.js';
import { workspaceGuard } from '../../middleware/workspace-guard.js';
import { permissionGuard } from '../../middleware/permission-guard.js';
import { validate } from '../../middleware/validate.js';
import * as workflowController from './workflow.controller.js';

export const workflowRouter: Router = Router();

const requireWorkflows = permissionGuard(PermissionFlagType.WORKFLOWS);

// Runs (declared before `/:id` so "runs" isn't swallowed by the id param).
workflowRouter.get(
  '/runs',
  authGuard,
  workspaceGuard,
  requireWorkflows,
  validate({ query: workflowRunQuerySchema }),
  workflowController.listRuns,
);
workflowRouter.get('/runs/:runId', authGuard, workspaceGuard, requireWorkflows, workflowController.showRun);

// In-app submission for a paused FORM step (mirrors the public /triggers/form/* pages, but scoped
// to an authenticated, permission-checked session for the run detail page).
workflowRouter.get(
  '/runs/:runId/form/:stepId',
  authGuard,
  workspaceGuard,
  requireWorkflows,
  workflowController.showPendingForm,
);
workflowRouter.post(
  '/runs/:runId/form/:stepId',
  authGuard,
  workspaceGuard,
  requireWorkflows,
  workflowController.submitPendingForm,
);

// Builder "Test" runs (synchronous) for HTTP / Code steps.
workflowRouter.post('/test/http', authGuard, workspaceGuard, requireWorkflows, workflowController.testHttp);
workflowRouter.post('/test/code', authGuard, workspaceGuard, requireWorkflows, workflowController.testCode);

// Runnable MANUAL-trigger workflows for a surface (global menu / record page / bulk bar) — declared
// before `/:id` so "runnable" isn't swallowed by the id param.
workflowRouter.get(
  '/runnable',
  authGuard,
  workspaceGuard,
  requireWorkflows,
  validate({ query: workflowRunnableQuerySchema }),
  workflowController.runnable,
);

// Workflow CRUD.
workflowRouter.get('/', authGuard, workspaceGuard, requireWorkflows, workflowController.index);
workflowRouter.post(
  '/',
  authGuard,
  workspaceGuard,
  requireWorkflows,
  validate({ body: createWorkflowRequestSchema }),
  workflowController.create,
);
workflowRouter.get('/:id', authGuard, workspaceGuard, requireWorkflows, workflowController.show);
workflowRouter.patch(
  '/:id',
  authGuard,
  workspaceGuard,
  requireWorkflows,
  validate({ body: updateWorkflowRequestSchema }),
  workflowController.update,
);
workflowRouter.delete('/:id', authGuard, workspaceGuard, requireWorkflows, workflowController.destroy);

// Version / draft model.
workflowRouter.get('/:id/draft', authGuard, workspaceGuard, requireWorkflows, workflowController.getDraft);
workflowRouter.delete(
  '/:id/draft',
  authGuard,
  workspaceGuard,
  requireWorkflows,
  workflowController.discardDraft,
);
workflowRouter.get('/:id/versions', authGuard, workspaceGuard, requireWorkflows, workflowController.listVersions);
workflowRouter.patch(
  '/:id/versions/:versionId',
  authGuard,
  workspaceGuard,
  requireWorkflows,
  validate({ body: updateWorkflowVersionRequestSchema }),
  workflowController.updateVersion,
);
workflowRouter.post('/:id/activate', authGuard, workspaceGuard, requireWorkflows, workflowController.activate);
workflowRouter.post('/:id/deactivate', authGuard, workspaceGuard, requireWorkflows, workflowController.deactivate);
workflowRouter.post('/:id/duplicate', authGuard, workspaceGuard, requireWorkflows, workflowController.duplicate);
workflowRouter.post(
  '/:id/run',
  authGuard,
  workspaceGuard,
  requireWorkflows,
  validate({ body: runWorkflowRequestSchema }),
  workflowController.run,
);
