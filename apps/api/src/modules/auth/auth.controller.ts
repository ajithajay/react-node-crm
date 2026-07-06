import type { Request, Response } from 'express';
import type {
  SignupRequest,
  VerifyEmailRequest,
  PasswordResetRequest,
  PasswordResetValidateRequest,
  PasswordResetConfirmRequest,
  SubdomainAvailabilityQuery,
  LoginRequest,
  LoginExchangeRequest,
  TwoFactorEnrollVerifyRequest,
  TwoFactorLoginVerifyRequest,
} from '@saasly/shared';
import * as authService from './auth.service.js';
import type { CreateWorkspaceWithTokenRequest, SelectWorkspaceWithTokenRequest } from './auth.validation.js';
import { REFRESH_COOKIE_NAME, refreshCookieOptions } from '../../lib/cookies.js';
import { UnauthorizedError } from '../../lib/errors.js';
import { record } from '../audit-log/audit-log.service.js';

function setRefreshCookie(res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE_NAME, token, refreshCookieOptions());
}

export async function signup(req: Request<unknown, unknown, SignupRequest>, res: Response): Promise<void> {
  const result = await authService.signup(req.body.email, req.body.password);
  res.status(201).json(result);
}

export async function verifyEmail(
  req: Request<unknown, unknown, VerifyEmailRequest>,
  res: Response,
): Promise<void> {
  const result = await authService.verifyEmail(req.body.token);
  res.status(200).json(result);
}

export async function requestPasswordReset(
  req: Request<unknown, unknown, PasswordResetRequest>,
  res: Response,
): Promise<void> {
  await authService.requestPasswordReset(req.body.email);
  res.status(200).json({ ok: true });
}

export async function validatePasswordResetToken(
  req: Request<unknown, unknown, PasswordResetValidateRequest>,
  res: Response,
): Promise<void> {
  const valid = await authService.validatePasswordResetToken(req.body.token);
  res.status(200).json({ valid });
}

export async function confirmPasswordReset(
  req: Request<unknown, unknown, PasswordResetConfirmRequest>,
  res: Response,
): Promise<void> {
  await authService.confirmPasswordReset(req.body.token, req.body.password);
  res.status(200).json({ ok: true });
}

export async function subdomainAvailability(
  req: Request<unknown, unknown, unknown, SubdomainAvailabilityQuery>,
  res: Response,
): Promise<void> {
  const result = await authService.checkSubdomainAvailability(req.query.subdomain);
  res.status(200).json(result);
}

export async function createWorkspace(
  req: Request<unknown, unknown, CreateWorkspaceWithTokenRequest>,
  res: Response,
): Promise<void> {
  const { userId } = authService.verifyWorkspaceAgnosticToken(req.body.token);
  const result = await authService.createWorkspace(userId, {
    name: req.body.name,
    subdomain: req.body.subdomain,
    logoUrl: req.body.logoUrl ?? null,
  });
  res.status(201).json(result);
}

export async function loginWorkspaceScoped(
  req: Request<unknown, unknown, LoginRequest>,
  res: Response,
): Promise<void> {
  if (!req.workspace) throw new UnauthorizedError('Workspace not found');
  const result = await authService.loginWorkspaceScoped(req.body.email, req.body.password, req.workspace.id);
  res.status(200).json(result);
}

export async function loginAgnostic(req: Request<unknown, unknown, LoginRequest>, res: Response): Promise<void> {
  const result = await authService.loginAgnostic(req.body.email, req.body.password);
  res.status(200).json(result);
}

export async function selectWorkspace(
  req: Request<unknown, unknown, SelectWorkspaceWithTokenRequest>,
  res: Response,
): Promise<void> {
  const result = await authService.selectWorkspace(req.body.token, req.body.workspaceId);
  res.status(200).json(result);
}

export async function exchangeLoginToken(
  req: Request<unknown, unknown, LoginExchangeRequest>,
  res: Response,
): Promise<void> {
  const result = await authService.exchangeLoginToken(req.body.token);
  setRefreshCookie(res, result.refreshToken);
  res.status(200).json(result);
}

export async function verifyLoginTwoFactor(
  req: Request<unknown, unknown, TwoFactorLoginVerifyRequest>,
  res: Response,
): Promise<void> {
  const result = await authService.verifyLoginTwoFactor(req.body.challengeToken, req.body.code);
  res.status(200).json(result);
}

export async function refresh(req: Request, res: Response): Promise<void> {
  const rawRefreshToken = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
  if (!rawRefreshToken) throw new UnauthorizedError('No refresh token');

  const result = await authService.refresh(rawRefreshToken, req.workspaceId ?? null);
  setRefreshCookie(res, result.refreshToken);
  res.status(200).json(result);
}

export async function logout(req: Request, res: Response): Promise<void> {
  const rawRefreshToken = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
  await authService.logout(rawRefreshToken);
  res.clearCookie(REFRESH_COOKIE_NAME, refreshCookieOptions());
  res.status(200).json({ ok: true });
}

export async function start2FAEnrollment(req: Request, res: Response): Promise<void> {
  const result = await authService.start2FAEnrollment(req.user!.id);
  res.status(200).json(result);
}

export async function verify2FAEnrollment(
  req: Request<unknown, unknown, TwoFactorEnrollVerifyRequest>,
  res: Response,
): Promise<void> {
  await authService.verify2FAEnrollment(req.user!.id, req.body.code);
  if (req.workspaceId) await record(req.workspaceId, req.user!.id, 'auth.two_factor_enabled');
  res.status(200).json({ ok: true });
}

export async function deactivate2FA(req: Request, res: Response): Promise<void> {
  await authService.deactivate2FA(req.user!.id);
  if (req.workspaceId) await record(req.workspaceId, req.user!.id, 'auth.two_factor_disabled');
  res.status(200).json({ ok: true });
}
