import { In } from 'typeorm';
import { UserEntity, WorkspaceMemberEntity } from '@saasly/database';
import { dataSource } from '../../lib/db.js';

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
