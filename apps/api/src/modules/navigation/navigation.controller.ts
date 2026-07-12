import type { Request, Response } from 'express';
import type { CreateNavigationMenuItemRequest, UpdateNavigationMenuItemRequest } from '@saasly/shared';
import * as navigationService from './navigation.service.js';

export async function list(req: Request, res: Response): Promise<void> {
  const result = await navigationService.listItems(req.workspaceId!, req.user!.id);
  res.status(200).json(result);
}

export async function create(
  req: Request<unknown, unknown, CreateNavigationMenuItemRequest>,
  res: Response,
): Promise<void> {
  const result = await navigationService.createItem(req.workspaceId!, req.user!.id, req.body);
  res.status(201).json(result);
}

export async function update(
  req: Request<{ id: string }, unknown, UpdateNavigationMenuItemRequest>,
  res: Response,
): Promise<void> {
  const result = await navigationService.updateItem(req.workspaceId!, req.user!.id, req.params.id, req.body);
  res.status(200).json(result);
}

export async function remove(req: Request<{ id: string }>, res: Response): Promise<void> {
  await navigationService.deleteItem(req.workspaceId!, req.user!.id, req.params.id);
  res.status(200).json({ ok: true });
}
