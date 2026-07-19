import type { Request, Response } from 'express';
import type {
  CreateRoleRequest,
  UpdateRoleRequest,
  UpdateSettingsPermissionsRequest,
  UpdateObjectPermissionRequest,
  UpdateFieldPermissionRequest,
  ReplaceRowLevelPermissionsRequest,
} from '@saasly/shared';
import * as roleService from './role.service.js';

export async function index(req: Request, res: Response): Promise<void> {
  const result = await roleService.listRoles(req.workspaceId!);
  res.status(200).json(result);
}

export async function show(req: Request<{ id: string }>, res: Response): Promise<void> {
  const result = await roleService.getRole(req.workspaceId!, req.params.id);
  res.status(200).json(result);
}

export async function create(
  req: Request<unknown, unknown, CreateRoleRequest>,
  res: Response,
): Promise<void> {
  const result = await roleService.createRole(req.workspaceId!, req.user!.id, req.body);
  res.status(201).json(result);
}

export async function update(
  req: Request<{ id: string }, unknown, UpdateRoleRequest>,
  res: Response,
): Promise<void> {
  const result = await roleService.updateRole(req.workspaceId!, req.params.id, req.user!.id, req.body);
  res.status(200).json(result);
}

export async function destroy(req: Request<{ id: string }>, res: Response): Promise<void> {
  await roleService.deleteRole(req.workspaceId!, req.params.id, req.user!.id);
  res.status(200).json({ ok: true });
}

export async function getSettingsPermissions(req: Request<{ id: string }>, res: Response): Promise<void> {
  const result = await roleService.getSettingsPermissions(req.workspaceId!, req.params.id);
  res.status(200).json(result);
}

export async function updateSettingsPermissions(
  req: Request<{ id: string }, unknown, UpdateSettingsPermissionsRequest>,
  res: Response,
): Promise<void> {
  await roleService.updateSettingsPermissions(req.workspaceId!, req.params.id, req.user!.id, req.body);
  res.status(200).json({ ok: true });
}

export async function listObjectPermissions(req: Request<{ id: string }>, res: Response): Promise<void> {
  const result = await roleService.listObjectPermissions(req.workspaceId!, req.params.id);
  res.status(200).json(result);
}

export async function updateObjectPermission(
  req: Request<{ id: string; objectMetadataId: string }, unknown, UpdateObjectPermissionRequest>,
  res: Response,
): Promise<void> {
  await roleService.updateObjectPermission(
    req.workspaceId!,
    req.params.id,
    req.params.objectMetadataId,
    req.user!.id,
    req.body,
  );
  res.status(200).json({ ok: true });
}

export async function removeObjectPermission(
  req: Request<{ id: string; objectMetadataId: string }>,
  res: Response,
): Promise<void> {
  await roleService.removeObjectPermission(req.workspaceId!, req.params.id, req.params.objectMetadataId, req.user!.id);
  res.status(200).json({ ok: true });
}

export async function listFieldPermissions(
  req: Request<{ id: string; objectMetadataId: string }>,
  res: Response,
): Promise<void> {
  const result = await roleService.listFieldPermissions(req.workspaceId!, req.params.id, req.params.objectMetadataId);
  res.status(200).json(result);
}

export async function updateFieldPermission(
  req: Request<{ id: string; fieldMetadataId: string }, unknown, UpdateFieldPermissionRequest>,
  res: Response,
): Promise<void> {
  await roleService.updateFieldPermission(
    req.workspaceId!,
    req.params.id,
    req.params.fieldMetadataId,
    req.user!.id,
    req.body,
  );
  res.status(200).json({ ok: true });
}

export async function listRowLevelPermissions(
  req: Request<{ id: string; objectMetadataId: string }>,
  res: Response,
): Promise<void> {
  const result = await roleService.listRowLevelPermissions(req.workspaceId!, req.params.id, req.params.objectMetadataId);
  res.status(200).json(result);
}

export async function replaceRowLevelPermissions(
  req: Request<{ id: string; objectMetadataId: string }, unknown, ReplaceRowLevelPermissionsRequest>,
  res: Response,
): Promise<void> {
  await roleService.replaceRowLevelPermissions(
    req.workspaceId!,
    req.params.id,
    req.params.objectMetadataId,
    req.user!.id,
    req.body,
  );
  res.status(200).json({ ok: true });
}

export async function listRoleMembers(req: Request<{ id: string }>, res: Response): Promise<void> {
  const result = await roleService.listRoleMembers(req.workspaceId!, req.params.id);
  res.status(200).json(result);
}
