import type { Request, Response } from 'express';
import type {
  CreateViewRequest,
  ListViewsQuery,
  SetViewFieldsRequest,
  SetViewFiltersRequest,
  SetViewGroupsRequest,
  SetViewSortsRequest,
  UpdateViewRequest,
} from '@saasly/shared';
import * as viewService from './view.service.js';

export async function index(req: Request, res: Response): Promise<void> {
  // validate() has already replaced req.query with the parsed ListViewsQuery at runtime.
  const { objectMetadataId } = req.query as unknown as ListViewsQuery;
  const result = await viewService.listViews(req.workspaceId!, objectMetadataId);
  res.status(200).json(result);
}

export async function show(req: Request<{ id: string }>, res: Response): Promise<void> {
  const result = await viewService.getView(req.workspaceId!, req.params.id);
  res.status(200).json(result);
}

export async function create(req: Request<unknown, unknown, CreateViewRequest>, res: Response): Promise<void> {
  const result = await viewService.createView(req.workspaceId!, req.body);
  res.status(201).json(result);
}

export async function update(
  req: Request<{ id: string }, unknown, UpdateViewRequest>,
  res: Response,
): Promise<void> {
  const result = await viewService.updateView(req.workspaceId!, req.params.id, req.body);
  res.status(200).json(result);
}

export async function destroy(req: Request<{ id: string }>, res: Response): Promise<void> {
  await viewService.deleteView(req.workspaceId!, req.params.id);
  res.status(200).json({ ok: true });
}

export async function setFields(
  req: Request<{ id: string }, unknown, SetViewFieldsRequest>,
  res: Response,
): Promise<void> {
  const result = await viewService.setViewFields(req.workspaceId!, req.params.id, req.body);
  res.status(200).json(result);
}

export async function setFilters(
  req: Request<{ id: string }, unknown, SetViewFiltersRequest>,
  res: Response,
): Promise<void> {
  const result = await viewService.setViewFilters(req.workspaceId!, req.params.id, req.body);
  res.status(200).json(result);
}

export async function setSorts(
  req: Request<{ id: string }, unknown, SetViewSortsRequest>,
  res: Response,
): Promise<void> {
  const result = await viewService.setViewSorts(req.workspaceId!, req.params.id, req.body);
  res.status(200).json(result);
}

export async function setGroups(
  req: Request<{ id: string }, unknown, SetViewGroupsRequest>,
  res: Response,
): Promise<void> {
  const result = await viewService.setViewGroups(req.workspaceId!, req.params.id, req.body);
  res.status(200).json(result);
}
