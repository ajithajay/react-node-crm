import type { Request, Response } from 'express';
import type { SendMessageRequest, TimelineThreadsQuery } from '@saasly/shared';
import { ForbiddenError } from '../../lib/errors.js';
import * as service from './messaging.service.js';

function memberId(req: Pick<Request, 'workspaceMember'>): string {
  if (!req.workspaceMember) throw new ForbiddenError('A workspace member is required');
  return req.workspaceMember.id;
}

export async function threads(req: Request, res: Response): Promise<void> {
  // req.query is validated + replaced by the `timelineThreadsQuerySchema` middleware.
  const { objectNameSingular, recordId, page } = req.query as unknown as TimelineThreadsQuery;
  const result = await service.listThreads(req.workspaceId!, objectNameSingular, recordId, page);
  res.status(200).json(result);
}

export async function thread(req: Request<{ id: string }>, res: Response): Promise<void> {
  const result = await service.getThread(req.workspaceId!, req.params.id);
  res.status(200).json(result);
}

export async function send(
  req: Request<unknown, unknown, SendMessageRequest>,
  res: Response,
): Promise<void> {
  await service.sendMessage(req.workspaceId!, memberId(req), req.body);
  res.status(202).json({ ok: true });
}
