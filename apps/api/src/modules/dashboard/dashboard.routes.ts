import { Router } from 'express';
import {
  chartDataRequestSchema,
  createDashboardRequestSchema,
  saveDashboardLayoutRequestSchema,
  updateDashboardRequestSchema,
  PermissionFlagType,
} from '@saasly/shared';
import { authGuard } from '../../middleware/auth-guard.js';
import { workspaceGuard } from '../../middleware/workspace-guard.js';
import { permissionGuard } from '../../middleware/permission-guard.js';
import { validate } from '../../middleware/validate.js';
import * as dashboardController from './dashboard.controller.js';

export const dashboardRouter: Router = Router();

/** Reuses the LAYOUTS flag (record-page layout customization) — dashboards are conceptually the
 * same "page layout" capability, and a dedicated DASHBOARDS flag isn't worth the extra role-setting
 * surface for v1. Chart-data reads still separately enforce per-object read permission (see
 * chart-data.service.ts#computeChartData) so a role without object read access never sees its data. */
const requireLayoutsPermission = permissionGuard(PermissionFlagType.LAYOUTS);

dashboardRouter.get('/', authGuard, workspaceGuard, dashboardController.index);
dashboardRouter.get('/:id', authGuard, workspaceGuard, dashboardController.show);
dashboardRouter.post(
  '/',
  authGuard,
  workspaceGuard,
  requireLayoutsPermission,
  validate({ body: createDashboardRequestSchema }),
  dashboardController.create,
);
dashboardRouter.patch(
  '/:id',
  authGuard,
  workspaceGuard,
  requireLayoutsPermission,
  validate({ body: updateDashboardRequestSchema }),
  dashboardController.update,
);
dashboardRouter.delete('/:id', authGuard, workspaceGuard, requireLayoutsPermission, dashboardController.destroy);
dashboardRouter.put(
  '/:id/layout',
  authGuard,
  workspaceGuard,
  requireLayoutsPermission,
  validate({ body: saveDashboardLayoutRequestSchema }),
  dashboardController.saveLayout,
);
dashboardRouter.post(
  '/chart-data',
  authGuard,
  workspaceGuard,
  validate({ body: chartDataRequestSchema }),
  dashboardController.chartData,
);
