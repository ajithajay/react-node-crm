import type { Request, Response } from 'express';
import type { UpdateWorkspaceRequest, SetDefaultRoleRequest } from '@saasly/shared';
import { AppError } from '../../lib/errors.js';
import { actorUserId, principalOf } from '../../lib/principal.js';
import * as workspaceService from './workspace.service.js';

export async function current(req: Request, res: Response): Promise<void> {
  const result = await workspaceService.getCurrentWorkspace(req.workspaceId!);
  res.status(200).json(result);
}

export async function update(
  req: Request<unknown, unknown, UpdateWorkspaceRequest>,
  res: Response,
): Promise<void> {
  const result = await workspaceService.updateWorkspace(req.workspaceId!, actorUserId(principalOf(req)), req.body);
  res.status(200).json(result);
}

export async function uploadLogo(req: Request, res: Response): Promise<void> {
  if (!req.file) throw new AppError('No file uploaded', 400);
  const result = await workspaceService.uploadLogo(
    req.workspaceId!,
    req.user!.id,
    req.file.buffer,
    req.file.originalname,
    req.file.mimetype,
  );
  res.status(200).json(result);
}

export async function removeLogo(req: Request, res: Response): Promise<void> {
  await workspaceService.removeLogo(req.workspaceId!, req.user!.id);
  res.status(200).json({ ok: true });
}

export async function setDefaultRole(
  req: Request<unknown, unknown, SetDefaultRoleRequest>,
  res: Response,
): Promise<void> {
  await workspaceService.setDefaultRole(req.workspaceId!, req.user!.id, req.body.roleId);
  res.status(200).json({ ok: true });
}

export async function remove(req: Request, res: Response): Promise<void> {
  await workspaceService.deleteWorkspace(req.workspaceId!, req.user!.id);
  res.status(200).json({ ok: true });
}
