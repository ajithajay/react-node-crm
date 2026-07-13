import type { Request, Response } from 'express';
import type { ChartDataRequest, CreateDashboardRequest, SaveDashboardLayoutRequest, UpdateDashboardRequest } from '@saasly/shared';
import type { Principal } from '../record/record-permission.js';
import * as dashboardService from './dashboard.service.js';
import * as chartDataService from './chart-data.service.js';

/** The acting principal — an API key when present, otherwise the logged-in user (record-module parity).
 * Typed structurally (not `Request`) so it accepts handlers whose route has no `:params` (their
 * `Request<unknown, ...>` isn't assignable to the full `Request<ParamsDictionary, ...>` shape). */
function principalOf(req: Pick<Request, 'apiKey' | 'user'>): Principal {
  if (req.apiKey) {
    return { type: 'apiKey', apiKeyId: req.apiKey.id, roleId: req.apiKey.roleId, name: req.apiKey.name };
  }
  return { type: 'user', userId: req.user!.id };
}

export async function index(req: Request, res: Response): Promise<void> {
  const result = await dashboardService.listDashboards(req.workspaceId!, principalOf(req));
  res.status(200).json(result);
}

export async function show(req: Request<{ id: string }>, res: Response): Promise<void> {
  const result = await dashboardService.getDashboard(req.workspaceId!, principalOf(req), req.params.id);
  res.status(200).json(result);
}

export async function create(req: Request<unknown, unknown, CreateDashboardRequest>, res: Response): Promise<void> {
  const result = await dashboardService.createDashboard(req.workspaceId!, principalOf(req), req.body.title);
  res.status(201).json(result);
}

export async function update(req: Request<{ id: string }, unknown, UpdateDashboardRequest>, res: Response): Promise<void> {
  const result = await dashboardService.updateDashboard(req.workspaceId!, principalOf(req), req.params.id, req.body.title);
  res.status(200).json(result);
}

export async function destroy(req: Request<{ id: string }>, res: Response): Promise<void> {
  await dashboardService.deleteDashboard(req.workspaceId!, principalOf(req), req.params.id);
  res.status(204).send();
}

export async function saveLayout(
  req: Request<{ id: string }, unknown, SaveDashboardLayoutRequest>,
  res: Response,
): Promise<void> {
  const result = await dashboardService.saveDashboardLayout(req.workspaceId!, principalOf(req), req.params.id, req.body);
  res.status(200).json(result);
}

export async function chartData(req: Request<unknown, unknown, ChartDataRequest>, res: Response): Promise<void> {
  const result = await chartDataService.computeChartData(
    req.workspaceId!,
    principalOf(req),
    req.body.objectMetadataId,
    req.body.configuration,
  );
  res.status(200).json(result);
}
