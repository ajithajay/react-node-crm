import type { Request, Response } from 'express';
import type {
  UpdateProfileRequest,
  UpdatePreferencesRequest,
  ChangePasswordRequest,
  DeleteAccountRequest,
} from '@saasly/shared';
import { AppError } from '../../lib/errors.js';
import * as userService from './user.service.js';

export async function me(req: Request, res: Response): Promise<void> {
  const result = await userService.getMe(req.user!.id, req.workspaceId!);
  res.status(200).json(result);
}

export async function updateMe(
  req: Request<unknown, unknown, UpdateProfileRequest>,
  res: Response,
): Promise<void> {
  await userService.updateProfile(req.user!.id, req.workspaceId!, req.body);
  res.status(200).json({ ok: true });
}

export async function updatePreferences(
  req: Request<unknown, unknown, UpdatePreferencesRequest>,
  res: Response,
): Promise<void> {
  await userService.updatePreferences(req.user!.id, req.workspaceId!, req.body);
  res.status(200).json({ ok: true });
}

export async function uploadAvatar(req: Request, res: Response): Promise<void> {
  if (!req.file) throw new AppError('No file uploaded', 400);
  const result = await userService.uploadAvatar(
    req.user!.id,
    req.workspaceId!,
    req.file.buffer,
    req.file.originalname,
    req.file.mimetype,
  );
  res.status(200).json(result);
}

export async function removeAvatar(req: Request, res: Response): Promise<void> {
  await userService.removeAvatar(req.user!.id, req.workspaceId!);
  res.status(200).json({ ok: true });
}

export async function changePassword(
  req: Request<unknown, unknown, ChangePasswordRequest>,
  res: Response,
): Promise<void> {
  await userService.changePassword(req.user!.id, req.workspaceId!, req.body.currentPassword, req.body.newPassword);
  res.status(200).json({ ok: true });
}

export async function deleteAccount(
  req: Request<unknown, unknown, DeleteAccountRequest>,
  res: Response,
): Promise<void> {
  await userService.deleteAccount(req.user!.id, req.body.password);
  res.status(200).json({ ok: true });
}
