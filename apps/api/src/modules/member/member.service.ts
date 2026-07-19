import { In } from 'typeorm';
import { RoleEntity, UserEntity, WorkspaceMemberEntity } from '@saasly/database';
import { dataSource } from '../../lib/db.js';
import { ForbiddenError, NotFoundError } from '../../lib/errors.js';
import { record } from '../audit-log/audit-log.service.js';

export interface MemberResponse {
  id: string;
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  roleId: string | null;
}

export async function listMembers(workspaceId: string): Promise<MemberResponse[]> {
  const members = await dataSource.getRepository(WorkspaceMemberEntity).findBy({ workspaceId });
  if (members.length === 0) return [];

  const users = await dataSource
    .getRepository(UserEntity)
    .findBy({ id: In(members.map((m) => m.userId)) });
  const emailByUserId = new Map(users.map((u) => [u.id, u.email]));

  return members.map((member) => ({
    id: member.id,
    userId: member.userId,
    email: emailByUserId.get(member.userId) ?? '',
    firstName: member.firstName,
    lastName: member.lastName,
    avatarUrl: member.avatarUrl,
    roleId: member.roleId,
  }));
}

export async function reassignRole(
  workspaceId: string,
  memberId: string,
  actorUserId: string | null,
  roleId: string,
): Promise<void> {
  const member = await dataSource.getRepository(WorkspaceMemberEntity).findOneBy({ id: memberId, workspaceId });
  if (!member) throw new NotFoundError('Member not found');
  if (actorUserId && member.userId === actorUserId) {
    throw new ForbiddenError("You can't change your own role");
  }

  const role = await dataSource.getRepository(RoleEntity).findOneBy({ id: roleId, workspaceId });
  if (!role) throw new NotFoundError('Role not found');

  const previousRoleId = member.roleId;
  member.roleId = roleId;
  await dataSource.getRepository(WorkspaceMemberEntity).save(member);

  await record(workspaceId, actorUserId, 'member.role_changed', {
    memberId,
    previousRoleId,
    roleId,
  });
}
