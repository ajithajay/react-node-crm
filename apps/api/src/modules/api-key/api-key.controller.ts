import type { Request, Response } from 'express';
import type { CreateApiKeyRequest } from '@saasly/shared';
import * as apiKeyService from './api-key.service.js';

export async function index(req: Request, res: Response): Promise<void> {
  const result = await apiKeyService.listApiKeys(req.workspaceId!);
  res.status(200).json(result);
}

export async function create(
  req: Request<unknown, unknown, CreateApiKeyRequest>,
  res: Response,
): Promise<void> {
  const result = await apiKeyService.createApiKey(req.workspaceId!, req.user!.id, req.body);
  res.status(201).json(result);
}

export async function revoke(req: Request<{ id: string }>, res: Response): Promise<void> {
  await apiKeyService.revokeApiKey(req.workspaceId!, req.params.id, req.user!.id);
  res.status(200).json({ ok: true });
}
