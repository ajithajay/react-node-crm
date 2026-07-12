import type { Request, Response } from 'express';
import type {
  CreateFieldRequest,
  CreateIndexRequest,
  CreateMorphRelationRequest,
  CreateObjectRequest,
  CreateRelationRequest,
  SetActiveRequest,
  SetFieldRecordPageVisibilityRequest,
  SetObjectIdentifiersRequest,
  UpdateFieldRequest,
  UpdateObjectRequest,
} from '@saasly/shared';
import type { SavePageLayoutRequest } from '@saasly/shared';
import * as dataModelService from './data-model.service.js';
import * as pageLayoutService from './page-layout.service.js';

export async function listObjects(req: Request, res: Response): Promise<void> {
  const result = await dataModelService.listObjects(req.workspaceId!);
  res.status(200).json(result);
}

export async function getObject(req: Request<{ id: string }>, res: Response): Promise<void> {
  const result = await dataModelService.getObject(req.workspaceId!, req.params.id);
  res.status(200).json(result);
}

export async function createObject(
  req: Request<unknown, unknown, CreateObjectRequest>,
  res: Response,
): Promise<void> {
  const result = await dataModelService.createObject(req.workspaceId!, req.user!.id, req.body);
  res.status(201).json(result);
}

export async function updateObject(
  req: Request<{ id: string }, unknown, UpdateObjectRequest>,
  res: Response,
): Promise<void> {
  const result = await dataModelService.updateObject(req.workspaceId!, req.params.id, req.user!.id, req.body);
  res.status(200).json(result);
}

export async function setObjectActive(
  req: Request<{ id: string }, unknown, SetActiveRequest>,
  res: Response,
): Promise<void> {
  await dataModelService.setObjectActive(req.workspaceId!, req.params.id, req.user!.id, req.body.isActive);
  res.status(200).json({ ok: true });
}

export async function deleteObject(req: Request<{ id: string }>, res: Response): Promise<void> {
  await dataModelService.deleteObject(req.workspaceId!, req.params.id, req.user!.id);
  res.status(200).json({ ok: true });
}

export async function createField(
  req: Request<{ id: string }, unknown, CreateFieldRequest>,
  res: Response,
): Promise<void> {
  const result = await dataModelService.createField(req.workspaceId!, req.params.id, req.user!.id, req.body);
  res.status(201).json(result);
}

export async function updateField(
  req: Request<{ id: string; fieldId: string }, unknown, UpdateFieldRequest>,
  res: Response,
): Promise<void> {
  const result = await dataModelService.updateField(req.workspaceId!, req.params.fieldId, req.user!.id, req.body);
  res.status(200).json(result);
}

export async function setFieldActive(
  req: Request<{ id: string; fieldId: string }, unknown, SetActiveRequest>,
  res: Response,
): Promise<void> {
  await dataModelService.setFieldActive(req.workspaceId!, req.params.fieldId, req.user!.id, req.body.isActive);
  res.status(200).json({ ok: true });
}

export async function setFieldRecordPageVisibility(
  req: Request<{ id: string; fieldId: string }, unknown, SetFieldRecordPageVisibilityRequest>,
  res: Response,
): Promise<void> {
  const result = await dataModelService.setFieldRecordPageVisibility(
    req.workspaceId!,
    req.params.fieldId,
    req.user!.id,
    req.body.isVisible,
  );
  res.status(200).json(result);
}

export async function deleteField(req: Request<{ id: string; fieldId: string }>, res: Response): Promise<void> {
  await dataModelService.deleteField(req.workspaceId!, req.params.fieldId, req.user!.id);
  res.status(200).json({ ok: true });
}

export async function createRelation(
  req: Request<{ id: string }, unknown, CreateRelationRequest>,
  res: Response,
): Promise<void> {
  const result = await dataModelService.createRelation(req.workspaceId!, req.params.id, req.user!.id, req.body);
  res.status(201).json(result);
}

export async function createMorphRelation(
  req: Request<{ id: string }, unknown, CreateMorphRelationRequest>,
  res: Response,
): Promise<void> {
  const result = await dataModelService.createMorphRelation(req.workspaceId!, req.params.id, req.user!.id, req.body);
  res.status(201).json(result);
}

export async function setObjectIdentifiers(
  req: Request<{ id: string }, unknown, SetObjectIdentifiersRequest>,
  res: Response,
): Promise<void> {
  const result = await dataModelService.setObjectIdentifiers(req.workspaceId!, req.params.id, req.user!.id, req.body);
  res.status(200).json(result);
}

export async function createIndex(
  req: Request<{ id: string }, unknown, CreateIndexRequest>,
  res: Response,
): Promise<void> {
  const result = await dataModelService.createIndex(req.workspaceId!, req.params.id, req.user!.id, req.body);
  res.status(201).json(result);
}

export async function deleteIndex(
  req: Request<{ id: string; indexId: string }>,
  res: Response,
): Promise<void> {
  await dataModelService.deleteIndex(req.workspaceId!, req.params.indexId, req.user!.id);
  res.status(200).json({ ok: true });
}

export async function listSections(req: Request<{ id: string }>, res: Response): Promise<void> {
  const result = await dataModelService.listSections(req.workspaceId!, req.params.id);
  res.status(200).json(result);
}

export async function setSections(req: Request<{ id: string }>, res: Response): Promise<void> {
  const result = await dataModelService.setSections(req.workspaceId!, req.params.id, req.user!.id, req.body);
  res.status(200).json(result);
}

export async function getPageLayout(req: Request<{ id: string }>, res: Response): Promise<void> {
  const result = await pageLayoutService.getPageLayout(req.workspaceId!, req.params.id);
  res.status(200).json(result);
}

export async function savePageLayout(
  req: Request<{ id: string }, unknown, SavePageLayoutRequest>,
  res: Response,
): Promise<void> {
  const result = await pageLayoutService.savePageLayout(req.workspaceId!, req.params.id, req.user!.id, req.body);
  res.status(200).json(result);
}

export async function resetPageLayout(req: Request<{ id: string }>, res: Response): Promise<void> {
  const result = await pageLayoutService.resetPageLayout(req.workspaceId!, req.params.id, req.user!.id);
  res.status(200).json(result);
}

export async function resetPageLayoutWidget(
  req: Request<{ id: string; widgetId: string }>,
  res: Response,
): Promise<void> {
  const result = await pageLayoutService.resetWidgetToDefault(
    req.workspaceId!,
    req.params.id,
    req.params.widgetId,
    req.user!.id,
  );
  res.status(200).json(result);
}
