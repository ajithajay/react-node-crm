import type { Request, Response } from 'express';
import type { CreateWebhookRequest, UpdateWebhookRequest } from '@saasly/shared';
import { actorUserId, principalOf } from '../../lib/principal.js';
import * as webhookService from './webhook.service.js';

export async function index(req: Request, res: Response): Promise<void> {
  const result = await webhookService.listWebhooks(req.workspaceId!);
  res.status(200).json(result);
}

export async function create(
  req: Request<unknown, unknown, CreateWebhookRequest>,
  res: Response,
): Promise<void> {
  const result = await webhookService.createWebhook(req.workspaceId!, actorUserId(principalOf(req)), req.body);
  res.status(201).json(result);
}

export async function update(
  req: Request<{ id: string }, unknown, UpdateWebhookRequest>,
  res: Response,
): Promise<void> {
  const result = await webhookService.updateWebhook(
    req.workspaceId!,
    req.params.id,
    actorUserId(principalOf(req)),
    req.body,
  );
  res.status(200).json(result);
}

export async function regenerateSecret(req: Request<{ id: string }>, res: Response): Promise<void> {
  const result = await webhookService.regenerateWebhookSecret(req.workspaceId!, req.params.id, actorUserId(principalOf(req)));
  res.status(200).json(result);
}

export async function destroy(req: Request<{ id: string }>, res: Response): Promise<void> {
  await webhookService.deleteWebhook(req.workspaceId!, req.params.id, actorUserId(principalOf(req)));
  res.status(200).json({ ok: true });
}
