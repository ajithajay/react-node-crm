import { randomBytes } from 'node:crypto';
import {
  InvitationEntity,
  InvitationStatus,
  RoleEntity,
  UserEntity,
  UserWorkspaceEntity,
  WorkspaceEntity,
  WorkspaceMemberEntity,
} from '@saasly/database';
import { dataSource } from '../../lib/db.js';
import { sha256Hex } from '../../lib/crypto.js';
import { hashPassword, verifyPassword } from '../../lib/password.js';
import { buildAppUrl } from '../../lib/urls.js';
import { sendInviteLinkEmail } from '../../lib/mailer.js';
import { AppError, ConflictError, NotFoundError, UnauthorizedError } from '../../lib/errors.js';
import { record } from '../audit-log/audit-log.service.js';
import { issueLoginRedirect } from '../auth/auth.service.js';
import { syncWorkspaceMemberRecord } from '../../lib/workspace-member-sync.js';

const invitationRepo = () => dataSource.getRepository(InvitationEntity);
const userRepo = () => dataSource.getRepository(UserEntity);
const workspaceRepo = () => dataSource.getRepository(WorkspaceEntity);
const userWorkspaceRepo = () => dataSource.getRepository(UserWorkspaceEntity);
const memberRepo = () => dataSource.getRepository(WorkspaceMemberEntity);
const roleRepo = () => dataSource.getRepository(RoleEntity);

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function generateRawToken(): string {
  return randomBytes(32).toString('hex');
}

export interface InvitationSummary {
  id: string;
  email: string;
  status: InvitationStatus;
  roleId: string | null;
  createdAt: Date;
  expiresAt: Date;
}

function toSummary(invitation: InvitationEntity): InvitationSummary {
  return {
    id: invitation.id,
    email: invitation.email,
    status: invitation.status,
    roleId: invitation.roleId,
    createdAt: invitation.createdAt,
    expiresAt: invitation.expiresAt,
  };
}

async function sendInvitationEmail(invitation: InvitationEntity, rawToken: string): Promise<void> {
  const workspace = await workspaceRepo().findOneByOrFail({ id: invitation.workspaceId });
  await sendInviteLinkEmail(invitation.email, buildAppUrl('/accept-invite', { token: rawToken }), workspace.name);
}

export async function createInvitation(
  workspaceId: string,
  invitedById: string,
  email: string,
  roleId?: string | null,
): Promise<InvitationSummary> {
  const normalizedEmail = email.trim().toLowerCase();

  const existingUser = await userRepo().findOneBy({ email: normalizedEmail });
  if (existingUser) {
    const alreadyMember = await memberRepo().findOneBy({ userId: existingUser.id, workspaceId });
    if (alreadyMember) throw new ConflictError('This person is already a member of this workspace');
  }

  if (roleId) {
    const role = await roleRepo().findOneBy({ id: roleId, workspaceId });
    if (!role) throw new NotFoundError('Role not found');
  }

  const rawToken = generateRawToken();
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

  // Re-inviting an existing (e.g. revoked or pending) row also lets the inviter change its role —
  // Twenty requires delete-then-resend for that; upserting here is simpler and equivalent.
  let invitation = await invitationRepo().findOneBy({ workspaceId, email: normalizedEmail });
  if (invitation) {
    invitation.tokenHash = sha256Hex(rawToken);
    invitation.status = InvitationStatus.PENDING;
    invitation.invitedById = invitedById;
    invitation.roleId = roleId ?? null;
    invitation.expiresAt = expiresAt;
  } else {
    invitation = invitationRepo().create({
      workspaceId,
      email: normalizedEmail,
      tokenHash: sha256Hex(rawToken),
      status: InvitationStatus.PENDING,
      invitedById,
      roleId: roleId ?? null,
      expiresAt,
    });
  }
  await invitationRepo().save(invitation);

  await sendInvitationEmail(invitation, rawToken);
  await record(workspaceId, invitedById, 'member.invited', { email: normalizedEmail });

  return toSummary(invitation);
}

export async function listInvitations(workspaceId: string): Promise<InvitationSummary[]> {
  const invitations = await invitationRepo().findBy({ workspaceId });
  return invitations
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .map(toSummary);
}

export async function resendInvitation(
  workspaceId: string,
  invitationId: string,
  actorUserId: string,
): Promise<void> {
  const invitation = await invitationRepo().findOneBy({ id: invitationId, workspaceId });
  if (!invitation) throw new NotFoundError('Invitation not found');
  if (invitation.status !== InvitationStatus.PENDING) {
    throw new ConflictError('Only pending invitations can be resent');
  }

  const rawToken = generateRawToken();
  invitation.tokenHash = sha256Hex(rawToken);
  invitation.expiresAt = new Date(Date.now() + INVITE_TTL_MS);
  await invitationRepo().save(invitation);

  await sendInvitationEmail(invitation, rawToken);
  await record(workspaceId, actorUserId, 'member.invite_resent', { email: invitation.email });
}

export async function revokeInvitation(
  workspaceId: string,
  invitationId: string,
  actorUserId: string,
): Promise<void> {
  const invitation = await invitationRepo().findOneBy({ id: invitationId, workspaceId });
  if (!invitation) throw new NotFoundError('Invitation not found');

  invitation.status = InvitationStatus.REVOKED;
  await invitationRepo().save(invitation);
  await record(workspaceId, actorUserId, 'member.invite_revoked', { email: invitation.email });
}

function assertActionable(invitation: InvitationEntity | null): asserts invitation is InvitationEntity {
  if (!invitation || invitation.status !== InvitationStatus.PENDING || invitation.expiresAt < new Date()) {
    throw new AppError('Invitation not found or expired', 400);
  }
}

export interface InvitationPreview {
  email: string;
  workspaceName: string;
  workspaceSubdomain: string;
  hasAccount: boolean;
}

export async function previewInvitation(rawToken: string): Promise<InvitationPreview> {
  const invitation = await invitationRepo().findOneBy({ tokenHash: sha256Hex(rawToken) });
  assertActionable(invitation);

  const workspace = await workspaceRepo().findOneByOrFail({ id: invitation.workspaceId });
  const hasAccount = (await userRepo().findOneBy({ email: invitation.email })) !== null;

  return { email: invitation.email, workspaceName: workspace.name, workspaceSubdomain: workspace.subdomain, hasAccount };
}

async function joinWorkspaceViaInvitation(invitation: InvitationEntity, userId: string): Promise<void> {
  const alreadyMember = await userWorkspaceRepo().findOneBy({ userId, workspaceId: invitation.workspaceId });
  if (!alreadyMember) {
    await userWorkspaceRepo().save(userWorkspaceRepo().create({ userId, workspaceId: invitation.workspaceId }));

    const [workspace, user] = await Promise.all([
      workspaceRepo().findOneByOrFail({ id: invitation.workspaceId }),
      userRepo().findOneByOrFail({ id: userId }),
    ]);
    const member = await memberRepo().save(
      memberRepo().create({
        workspaceId: invitation.workspaceId,
        userId,
        roleId: invitation.roleId ?? workspace.defaultRoleId,
        firstName: user.firstName,
        lastName: user.lastName,
      }),
    );
    await syncWorkspaceMemberRecord(invitation.workspaceId, member);
  }

  invitation.status = InvitationStatus.ACCEPTED;
  await invitationRepo().save(invitation);
  await record(invitation.workspaceId, userId, 'member.joined', { email: invitation.email });
}

export async function acceptInvitation(
  rawToken: string,
  password: string,
): Promise<{ loginToken: string; redirectUrl: string }> {
  const invitation = await invitationRepo().findOneBy({ tokenHash: sha256Hex(rawToken) });
  assertActionable(invitation);

  let user = await userRepo().findOneBy({ email: invitation.email });
  if (user) {
    if (!user.passwordHash || !(await verifyPassword(user.passwordHash, password))) {
      throw new UnauthorizedError('Incorrect password');
    }
  } else {
    user = await userRepo().save(
      userRepo().create({ email: invitation.email, passwordHash: await hashPassword(password), isEmailVerified: true }),
    );
  }

  await joinWorkspaceViaInvitation(invitation, user.id);
  return issueLoginRedirect(user.id, invitation.workspaceId);
}
