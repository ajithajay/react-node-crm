import { IsNull } from 'typeorm';
import {
  UserEntity,
  WorkspaceMemberEntity,
  UserWorkspaceEntity,
  RefreshTokenEntity,
  TwoFactorMethodEntity,
} from '@saasly/database';
import { dataSource } from '../../lib/db.js';
import { hashPassword, verifyPassword } from '../../lib/password.js';
import { sendPasswordChangedEmail } from '../../lib/mailer.js';
import { UnauthorizedError } from '../../lib/errors.js';
import { hasVerifiedTwoFactor } from '../auth/auth.service.js';
import { uploadFile, deleteFile, fileIdFromUrl } from '../file/file.service.js';

export interface MeResponse {
  id: string;
  email: string;
  isEmailVerified: boolean;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  roleId: string | null;
  colorScheme: string;
  twoFactorEnabled: boolean;
}

const memberRepo = () => dataSource.getRepository(WorkspaceMemberEntity);
const userRepo = () => dataSource.getRepository(UserEntity);

export async function getMe(userId: string, workspaceId: string): Promise<MeResponse> {
  const user = await userRepo().findOneByOrFail({ id: userId });
  const member = await memberRepo().findOneBy({ userId, workspaceId });
  const twoFactorEnabled = await hasVerifiedTwoFactor(userId);

  return {
    id: user.id,
    email: user.email,
    isEmailVerified: user.isEmailVerified,
    firstName: member?.firstName || user.firstName,
    lastName: member?.lastName || user.lastName,
    avatarUrl: member?.avatarUrl ?? null,
    roleId: member?.roleId ?? null,
    colorScheme: member?.colorScheme ?? 'SYSTEM',
    twoFactorEnabled,
  };
}

export async function updateProfile(
  userId: string,
  workspaceId: string,
  input: { firstName: string; lastName: string },
): Promise<void> {
  const member = await memberRepo().findOneByOrFail({ userId, workspaceId });
  member.firstName = input.firstName;
  member.lastName = input.lastName;
  await memberRepo().save(member);
}

export async function uploadAvatar(
  userId: string,
  workspaceId: string,
  buffer: Buffer,
  originalName: string,
  mimeType: string,
): Promise<{ avatarUrl: string }> {
  const member = await memberRepo().findOneByOrFail({ userId, workspaceId });
  const previousFileId = fileIdFromUrl(member.avatarUrl);

  const uploaded = await uploadFile(workspaceId, buffer, originalName, mimeType, 'avatars');
  member.avatarUrl = uploaded.url;
  await memberRepo().save(member);

  if (previousFileId) await deleteFile(previousFileId, workspaceId);
  return { avatarUrl: uploaded.url };
}

export async function removeAvatar(userId: string, workspaceId: string): Promise<void> {
  const member = await memberRepo().findOneByOrFail({ userId, workspaceId });
  const previousFileId = fileIdFromUrl(member.avatarUrl);

  member.avatarUrl = null;
  await memberRepo().save(member);

  if (previousFileId) await deleteFile(previousFileId, workspaceId);
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const user = await userRepo().findOneByOrFail({ id: userId });
  if (!user.passwordHash || !(await verifyPassword(user.passwordHash, currentPassword))) {
    throw new UnauthorizedError('Current password is incorrect');
  }

  user.passwordHash = await hashPassword(newPassword);
  await userRepo().save(user);

  await dataSource
    .getRepository(RefreshTokenEntity)
    .update({ userId, revokedAt: IsNull() }, { revokedAt: new Date() });

  await sendPasswordChangedEmail(user.email);
}

export async function deleteAccount(userId: string, password: string): Promise<void> {
  const user = await userRepo().findOneByOrFail({ id: userId });
  if (!user.passwordHash || !(await verifyPassword(user.passwordHash, password))) {
    throw new UnauthorizedError('Password is incorrect');
  }

  await dataSource.transaction(async (manager) => {
    await manager.delete(RefreshTokenEntity, { userId });
    await manager.delete(TwoFactorMethodEntity, { userId });
    await manager.delete(WorkspaceMemberEntity, { userId });
    await manager.delete(UserWorkspaceEntity, { userId });
    await manager.delete(UserEntity, { id: userId });
  });
}
