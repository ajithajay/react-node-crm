import { IsNull } from 'typeorm';
import { generateSecret as generateTotpSecret, generateURI as generateTotpUri, verify as verifyTotp } from 'otplib';
import QRCode from 'qrcode';
import {
  UserEntity,
  WorkspaceEntity,
  WorkspaceActivationStatus,
  UserWorkspaceEntity,
  WorkspaceMemberEntity,
  RefreshTokenEntity,
  TwoFactorMethodEntity,
  TwoFactorMethodStatus,
  provisionWorkspace,
} from '@saasly/database';
import { TokenType, isReservedSubdomain, isValidSubdomainFormat } from '@saasly/shared';
import { dataSource } from '../../lib/db.js';
import { hashPassword, verifyPassword } from '../../lib/password.js';
import { signToken, verifyToken, type TokenPayload } from '../../lib/jwt.js';
import { sha256Hex, encryptSecret, decryptSecret } from '../../lib/crypto.js';
import { parseDurationMs } from '../../lib/duration.js';
import { buildAppUrl, buildWorkspaceUrl } from '../../lib/urls.js';
import { env } from '../../lib/config.js';
import { AppError, ConflictError, NotFoundError, UnauthorizedError } from '../../lib/errors.js';
import { sendVerifyEmail, sendPasswordResetEmail, sendPasswordChangedEmail } from '../../lib/mailer.js';

const userRepo = () => dataSource.getRepository(UserEntity);
const workspaceRepo = () => dataSource.getRepository(WorkspaceEntity);
const userWorkspaceRepo = () => dataSource.getRepository(UserWorkspaceEntity);
const memberRepo = () => dataSource.getRepository(WorkspaceMemberEntity);
const refreshTokenRepo = () => dataSource.getRepository(RefreshTokenEntity);
const twoFactorRepo = () => dataSource.getRepository(TwoFactorMethodEntity);

/** Verifies a token, translating the internal TokenError into a 400 the client can act on. */
function verifyOrThrow<T extends TokenPayload>(token: string, type: TokenType): T {
  try {
    return verifyToken<T>(token, type);
  } catch {
    throw new AppError('Invalid or expired token', 400);
  }
}

export function verifyWorkspaceAgnosticToken(token: string): { userId: string } {
  const payload = verifyOrThrow<TokenPayload>(token, TokenType.WORKSPACE_AGNOSTIC);
  return { userId: payload.sub };
}

// ---- Signup / email verification ----

export async function signup(email: string, password: string): Promise<{ userId: string }> {
  const existing = await userRepo().findOneBy({ email });
  if (existing) throw new ConflictError('Email already registered');

  const passwordHash = await hashPassword(password);
  const user = await userRepo().save(userRepo().create({ email, passwordHash, isEmailVerified: false }));

  const token = signToken({ sub: user.id, type: TokenType.EMAIL_VERIFICATION });
  await sendVerifyEmail(user.email, buildAppUrl('/verify-email', { token }));

  return { userId: user.id };
}

export async function verifyEmail(token: string): Promise<{ workspaceAgnosticToken: string }> {
  const payload = verifyOrThrow<TokenPayload>(token, TokenType.EMAIL_VERIFICATION);
  const user = await userRepo().findOneBy({ id: payload.sub });
  if (!user) throw new NotFoundError('User not found');

  if (!user.isEmailVerified) {
    user.isEmailVerified = true;
    await userRepo().save(user);
  }

  return { workspaceAgnosticToken: signToken({ sub: user.id, type: TokenType.WORKSPACE_AGNOSTIC }) };
}

// ---- Password reset ----

export async function requestPasswordReset(email: string): Promise<void> {
  const user = await userRepo().findOneBy({ email });
  if (!user) return; // don't leak whether the email is registered

  const token = signToken({ sub: user.id, type: TokenType.PASSWORD_RESET });
  await sendPasswordResetEmail(user.email, buildAppUrl('/reset-password', { token }));
}

export async function validatePasswordResetToken(token: string): Promise<boolean> {
  try {
    verifyToken(token, TokenType.PASSWORD_RESET);
    return true;
  } catch {
    return false;
  }
}

export async function confirmPasswordReset(token: string, newPassword: string): Promise<void> {
  const payload = verifyOrThrow<TokenPayload>(token, TokenType.PASSWORD_RESET);
  const user = await userRepo().findOneBy({ id: payload.sub });
  if (!user) throw new NotFoundError('User not found');

  user.passwordHash = await hashPassword(newPassword);
  await userRepo().save(user);
  await refreshTokenRepo().update({ userId: user.id, revokedAt: IsNull() }, { revokedAt: new Date() });

  await sendPasswordChangedEmail(user.email);
}

// ---- Subdomain / workspace creation ----

export interface SubdomainAvailability {
  available: boolean;
  reason?: 'invalid_format' | 'reserved' | 'taken';
  suggestions?: string[];
}

async function isSubdomainTaken(subdomain: string): Promise<boolean> {
  return (await workspaceRepo().findOneBy({ subdomain })) !== null;
}

async function generateSubdomainSuggestions(base: string): Promise<string[]> {
  const candidates = [`${base}-hq`, `${base}1`, `${base}2`, `${base}-team`, `${base}-inc`];
  const suggestions: string[] = [];
  for (const candidate of candidates) {
    if (suggestions.length >= 3) break;
    if (!isValidSubdomainFormat(candidate) || isReservedSubdomain(candidate)) continue;
    if (!(await isSubdomainTaken(candidate))) suggestions.push(candidate);
  }
  return suggestions;
}

export async function checkSubdomainAvailability(subdomain: string): Promise<SubdomainAvailability> {
  const normalized = subdomain.trim().toLowerCase();
  if (!isValidSubdomainFormat(normalized)) return { available: false, reason: 'invalid_format' };
  if (isReservedSubdomain(normalized)) {
    return { available: false, reason: 'reserved', suggestions: await generateSubdomainSuggestions(normalized) };
  }
  if (await isSubdomainTaken(normalized)) {
    return { available: false, reason: 'taken', suggestions: await generateSubdomainSuggestions(normalized) };
  }
  return { available: true };
}

export async function createWorkspace(
  userId: string,
  input: { name: string; subdomain: string; logoUrl?: string | null },
): Promise<{ loginToken: string; redirectUrl: string }> {
  const availability = await checkSubdomainAvailability(input.subdomain);
  if (!availability.available) throw new ConflictError(`Subdomain unavailable: ${availability.reason}`);

  const user = await userRepo().findOneByOrFail({ id: userId });
  const subdomain = input.subdomain.trim().toLowerCase();

  const workspace = await workspaceRepo().save(
    workspaceRepo().create({
      name: input.name,
      subdomain,
      logoUrl: input.logoUrl ?? null,
      databaseSchema: '',
      activationStatus: WorkspaceActivationStatus.PENDING_CREATION,
    }),
  );

  const provisioned = await provisionWorkspace(dataSource, workspace.id);

  await userWorkspaceRepo().save(userWorkspaceRepo().create({ userId, workspaceId: workspace.id }));
  await memberRepo().save(
    memberRepo().create({
      workspaceId: workspace.id,
      userId,
      roleId: provisioned.workspace.defaultRoleId,
      firstName: user.firstName,
      lastName: user.lastName,
    }),
  );

  return issueLoginRedirect(userId, workspace.id);
}

// ---- Session issuance ----

async function issueSessionTokens(
  userId: string,
  workspaceId: string,
): Promise<{ accessToken: string; refreshToken: string }> {
  const member = await memberRepo().findOneBy({ userId, workspaceId });
  if (!member) throw new UnauthorizedError('Not a member of this workspace');

  const accessToken = signToken({
    sub: userId,
    type: TokenType.ACCESS,
    workspaceId,
    userWorkspaceId: member.id,
  });

  const refreshToken = signToken({ sub: userId, type: TokenType.REFRESH });
  await refreshTokenRepo().save(
    refreshTokenRepo().create({
      userId,
      tokenHash: sha256Hex(refreshToken),
      expiresAt: new Date(Date.now() + parseDurationMs(env.REFRESH_TOKEN_TTL)),
      revokedAt: null,
    }),
  );

  return { accessToken, refreshToken };
}

async function requiresTwoFactorChallenge(userId: string): Promise<boolean> {
  const method = await twoFactorRepo().findOneBy({ userId, status: TwoFactorMethodStatus.VERIFIED });
  return method !== null;
}

export type LoginResult =
  | { requiresTwoFactor: true; challengeToken: string }
  | { requiresTwoFactor: false; loginToken: string; redirectUrl: string };

/**
 * Always resolves to either a 2FA challenge or a single-use LOGIN token + redirect — never raw
 * session tokens directly, since the caller may be on a different host (app.<base>) than the
 * target workspace subdomain. The redirect's `/auth/exchange` step (same host as the workspace)
 * is what actually issues ACCESS/REFRESH (see `exchangeLoginToken`).
 */
async function completeWorkspaceLogin(userId: string, workspaceId: string): Promise<LoginResult> {
  const membership = await userWorkspaceRepo().findOneBy({ userId, workspaceId });
  if (!membership) throw new UnauthorizedError('Invalid email or password');

  if (await requiresTwoFactorChallenge(userId)) {
    const challengeToken = signToken({ sub: userId, type: TokenType.TWO_FACTOR_CHALLENGE, workspaceId });
    return { requiresTwoFactor: true, challengeToken };
  }

  return { requiresTwoFactor: false, ...(await issueLoginRedirect(userId, workspaceId)) };
}

async function issueLoginRedirect(userId: string, workspaceId: string): Promise<{ loginToken: string; redirectUrl: string }> {
  const workspace = await workspaceRepo().findOneByOrFail({ id: workspaceId });
  const loginToken = signToken({ sub: userId, type: TokenType.LOGIN, workspaceId });
  return {
    loginToken,
    redirectUrl: buildWorkspaceUrl(workspace.subdomain, `/auth/exchange?token=${encodeURIComponent(loginToken)}`),
  };
}

async function verifyCredentials(email: string, password: string): Promise<UserEntity> {
  const user = await userRepo().findOneBy({ email });
  if (!user?.passwordHash || !(await verifyPassword(user.passwordHash, password))) {
    throw new UnauthorizedError('Invalid email or password');
  }
  return user;
}

export async function loginWorkspaceScoped(
  email: string,
  password: string,
  workspaceId: string,
): Promise<LoginResult> {
  const user = await verifyCredentials(email, password);
  return completeWorkspaceLogin(user.id, workspaceId);
}

export interface WorkspaceSummary {
  id: string;
  name: string;
  subdomain: string;
}

export type AgnosticLoginResult = { workspaces: WorkspaceSummary[] } & (
  | { requiresTwoFactor: true; challengeToken: string }
  | { requiresTwoFactor: false; loginToken: string; redirectUrl: string }
  | { requiresTwoFactor: false; workspaceAgnosticToken: string }
);

export async function loginAgnostic(email: string, password: string): Promise<AgnosticLoginResult> {
  const user = await verifyCredentials(email, password);

  const memberships = await userWorkspaceRepo().findBy({ userId: user.id });
  const workspaces = await Promise.all(
    memberships.map(async (m): Promise<WorkspaceSummary> => {
      const ws = await workspaceRepo().findOneByOrFail({ id: m.workspaceId });
      return { id: ws.id, name: ws.name, subdomain: ws.subdomain };
    }),
  );

  if (workspaces.length === 1) {
    const result = await completeWorkspaceLogin(user.id, workspaces[0]!.id);
    return { workspaces, ...result };
  }

  return {
    workspaces,
    requiresTwoFactor: false,
    workspaceAgnosticToken: signToken({ sub: user.id, type: TokenType.WORKSPACE_AGNOSTIC }),
  };
}

export async function selectWorkspace(workspaceAgnosticToken: string, workspaceId: string): Promise<LoginResult> {
  const payload = verifyOrThrow<TokenPayload>(workspaceAgnosticToken, TokenType.WORKSPACE_AGNOSTIC);
  return completeWorkspaceLogin(payload.sub, workspaceId);
}

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
  workspaceId: string;
}

export async function exchangeLoginToken(token: string): Promise<SessionTokens> {
  const payload = verifyOrThrow<TokenPayload>(token, TokenType.LOGIN);
  if (!payload.workspaceId) throw new AppError('Malformed login token', 400);
  const { accessToken, refreshToken } = await issueSessionTokens(payload.sub, payload.workspaceId);
  return { accessToken, refreshToken, workspaceId: payload.workspaceId };
}

/** Verifies the TOTP code and resolves to a LOGIN redirect, same as any other completed login. */
export async function verifyLoginTwoFactor(
  challengeToken: string,
  code: string,
): Promise<{ loginToken: string; redirectUrl: string }> {
  const payload = verifyOrThrow<TokenPayload>(challengeToken, TokenType.TWO_FACTOR_CHALLENGE);
  if (!payload.workspaceId) throw new AppError('Malformed challenge token', 400);

  const method = await twoFactorRepo().findOneBy({ userId: payload.sub, status: TwoFactorMethodStatus.VERIFIED });
  if (!method) throw new UnauthorizedError('Two-factor authentication is not enabled for this account');

  const secret = decryptSecret(method.secretCiphertext);
  const result = await verifyTotp({ secret, token: code });
  if (!result.valid) throw new UnauthorizedError('Invalid code');

  return issueLoginRedirect(payload.sub, payload.workspaceId);
}

// ---- Refresh / logout ----

export interface RefreshResult {
  accessToken?: string;
  workspaceId?: string;
  refreshToken: string;
  workspaceAgnosticToken?: string;
}

export async function refresh(rawRefreshToken: string, workspaceId: string | null): Promise<RefreshResult> {
  const payload = verifyOrThrow<TokenPayload>(rawRefreshToken, TokenType.REFRESH);
  const tokenHash = sha256Hex(rawRefreshToken);
  const record = await refreshTokenRepo().findOneBy({ userId: payload.sub, tokenHash });
  if (!record || record.revokedAt || record.expiresAt < new Date()) {
    throw new UnauthorizedError('Refresh token is invalid or expired');
  }

  record.revokedAt = new Date();
  await refreshTokenRepo().save(record);

  if (!workspaceId) {
    const newRefreshToken = signToken({ sub: payload.sub, type: TokenType.REFRESH });
    await refreshTokenRepo().save(
      refreshTokenRepo().create({
        userId: payload.sub,
        tokenHash: sha256Hex(newRefreshToken),
        expiresAt: new Date(Date.now() + parseDurationMs(env.REFRESH_TOKEN_TTL)),
        revokedAt: null,
      }),
    );
    return {
      refreshToken: newRefreshToken,
      workspaceAgnosticToken: signToken({ sub: payload.sub, type: TokenType.WORKSPACE_AGNOSTIC }),
    };
  }

  const { accessToken, refreshToken: rotatedRefreshToken } = await issueSessionTokens(payload.sub, workspaceId);
  return { accessToken, workspaceId, refreshToken: rotatedRefreshToken };
}

export async function logout(rawRefreshToken: string | undefined): Promise<void> {
  if (!rawRefreshToken) return;
  try {
    const payload = verifyToken<TokenPayload>(rawRefreshToken, TokenType.REFRESH);
    await refreshTokenRepo().update(
      { userId: payload.sub, tokenHash: sha256Hex(rawRefreshToken) },
      { revokedAt: new Date() },
    );
  } catch {
    // already invalid/expired — nothing to revoke
  }
}

// ---- 2FA / TOTP ----

export async function start2FAEnrollment(
  userId: string,
): Promise<{ otpauthUrl: string; secret: string; qrCodeDataUrl: string }> {
  const user = await userRepo().findOneByOrFail({ id: userId });

  const alreadyVerified = await twoFactorRepo().findOneBy({ userId, status: TwoFactorMethodStatus.VERIFIED });
  if (alreadyVerified) throw new ConflictError('Two-factor authentication is already enabled');

  await twoFactorRepo().delete({ userId, status: TwoFactorMethodStatus.PENDING });

  const secret = generateTotpSecret();
  const otpauthUrl = generateTotpUri({ issuer: 'Saasly CRM', label: user.email, secret });
  const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

  await twoFactorRepo().save(
    twoFactorRepo().create({
      userId,
      strategy: 'TOTP',
      secretCiphertext: encryptSecret(secret),
      status: TwoFactorMethodStatus.PENDING,
    }),
  );

  return { otpauthUrl, secret, qrCodeDataUrl };
}

export async function verify2FAEnrollment(userId: string, code: string): Promise<void> {
  const method = await twoFactorRepo().findOneBy({ userId, status: TwoFactorMethodStatus.PENDING });
  if (!method) throw new NotFoundError('No pending two-factor enrollment');

  const secret = decryptSecret(method.secretCiphertext);
  const result = await verifyTotp({ secret, token: code });
  if (!result.valid) throw new UnauthorizedError('Invalid code');

  method.status = TwoFactorMethodStatus.VERIFIED;
  await twoFactorRepo().save(method);
}

export async function deactivate2FA(userId: string): Promise<void> {
  await twoFactorRepo().delete({ userId });
}
