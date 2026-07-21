import type { Request, Response } from 'express';
import { ForbiddenError } from '../../lib/errors.js';
import { buildGoogleAuthUrl, handleGoogleCallback } from './oauth.service.js';

export async function googleInit(req: Request, res: Response): Promise<void> {
  if (!req.workspaceMember) throw new ForbiddenError('A workspace member is required');
  const url = buildGoogleAuthUrl(req.workspaceId!, req.workspaceMember.id);
  res.status(200).json({ url });
}

export async function googleCallback(req: Request, res: Response): Promise<void> {
  const code = typeof req.query.code === 'string' ? req.query.code : '';
  const state = typeof req.query.state === 'string' ? req.query.state : '';
  const redirectTo = await handleGoogleCallback(code, state);
  res.redirect(redirectTo);
}

export function microsoftInit(_req: Request, res: Response): void {
  res.status(501).json({ error: 'Microsoft accounts are not implemented yet.' });
}
