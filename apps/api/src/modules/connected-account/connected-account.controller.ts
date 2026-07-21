import type { Request, Response } from 'express';
import type {
  CreateImapSmtpAccountRequest,
  UpdateCalendarChannelRequest,
  UpdateImapSmtpAccountRequest,
  UpdateMessageChannelRequest,
  UpdateMessageFoldersRequest,
} from '@saasly/shared';
import { actorUserId, principalOf } from '../../lib/principal.js';
import { ForbiddenError } from '../../lib/errors.js';
import * as service from './connected-account.service.js';

/** Connected accounts are per-member; every handler requires a resolved workspace member. */
function memberId(req: Pick<Request, 'workspaceMember'>): string {
  if (!req.workspaceMember) throw new ForbiddenError('A workspace member is required');
  return req.workspaceMember.id;
}

export async function index(req: Request, res: Response): Promise<void> {
  const result = await service.listConnectedAccounts(req.workspaceId!, memberId(req));
  res.status(200).json(result);
}

export async function show(req: Request<{ id: string }>, res: Response): Promise<void> {
  const result = await service.getConnectedAccount(req.workspaceId!, memberId(req), req.params.id);
  res.status(200).json(result);
}

export async function destroy(req: Request<{ id: string }>, res: Response): Promise<void> {
  await service.deleteConnectedAccount(
    req.workspaceId!,
    memberId(req),
    actorUserId(principalOf(req)),
    req.params.id,
  );
  res.status(200).json({ ok: true });
}

export async function createImapSmtp(
  req: Request<unknown, unknown, CreateImapSmtpAccountRequest>,
  res: Response,
): Promise<void> {
  const result = await service.createImapSmtpAccount(
    req.workspaceId!,
    memberId(req),
    actorUserId(principalOf(req)),
    req.body,
  );
  res.status(201).json(result);
}

export async function updateImapSmtp(
  req: Request<{ id: string }, unknown, UpdateImapSmtpAccountRequest>,
  res: Response,
): Promise<void> {
  const result = await service.updateImapSmtpAccount(req.workspaceId!, memberId(req), req.params.id, req.body);
  res.status(200).json(result);
}

export async function updateMessageChannel(
  req: Request<{ id: string }, unknown, UpdateMessageChannelRequest>,
  res: Response,
): Promise<void> {
  await service.updateMessageChannel(req.workspaceId!, memberId(req), req.params.id, req.body);
  res.status(200).json({ ok: true });
}

export async function updateCalendarChannel(
  req: Request<{ id: string }, unknown, UpdateCalendarChannelRequest>,
  res: Response,
): Promise<void> {
  await service.updateCalendarChannel(req.workspaceId!, memberId(req), req.params.id, req.body);
  res.status(200).json({ ok: true });
}

export async function updateMessageFolders(
  req: Request<{ id: string }, unknown, UpdateMessageFoldersRequest>,
  res: Response,
): Promise<void> {
  await service.updateMessageFolders(req.workspaceId!, memberId(req), req.params.id, req.body);
  res.status(200).json({ ok: true });
}

export async function syncMessageChannel(req: Request<{ id: string }>, res: Response): Promise<void> {
  await service.syncMessageChannelNow(req.workspaceId!, memberId(req), req.params.id, actorUserId(principalOf(req)));
  res.status(202).json({ ok: true });
}

export async function syncCalendarChannel(req: Request<{ id: string }>, res: Response): Promise<void> {
  await service.syncCalendarChannelNow(req.workspaceId!, memberId(req), req.params.id, actorUserId(principalOf(req)));
  res.status(202).json({ ok: true });
}
