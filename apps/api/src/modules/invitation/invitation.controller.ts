import type { Request, Response } from 'express';
import type { CreateInvitationRequest, AcceptInvitationRequest } from '@saasly/shared';
import * as invitationService from './invitation.service.js';

// ---- Admin (workspace-scoped) ----

export async function create(
  req: Request<unknown, unknown, CreateInvitationRequest>,
  res: Response,
): Promise<void> {
  const result = await invitationService.createInvitation(
    req.workspaceId!,
    req.user!.id,
    req.body.email,
    req.body.roleId,
  );
  res.status(201).json(result);
}

export async function index(req: Request, res: Response): Promise<void> {
  const result = await invitationService.listInvitations(req.workspaceId!);
  res.status(200).json(result);
}

export async function resend(req: Request<{ id: string }>, res: Response): Promise<void> {
  await invitationService.resendInvitation(req.workspaceId!, req.params.id, req.user!.id);
  res.status(200).json({ ok: true });
}

export async function revoke(req: Request<{ id: string }>, res: Response): Promise<void> {
  await invitationService.revokeInvitation(req.workspaceId!, req.params.id, req.user!.id);
  res.status(200).json({ ok: true });
}

// ---- Public (accept flow) ----

export async function preview(req: Request<{ token: string }>, res: Response): Promise<void> {
  const result = await invitationService.previewInvitation(req.params.token);
  res.status(200).json(result);
}

export async function accept(
  req: Request<{ token: string }, unknown, AcceptInvitationRequest>,
  res: Response,
): Promise<void> {
  const result = await invitationService.acceptInvitation(req.params.token, req.body.password);
  res.status(200).json(result);
}
