import { UserEntity, WorkspaceMemberEntity } from '@saasly/database';
import { dataSource } from '../../lib/db.js';

export interface MeResponse {
  id: string;
  email: string;
  isEmailVerified: boolean;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  roleId: string | null;
  colorScheme: string;
}

export async function getMe(userId: string, workspaceId: string): Promise<MeResponse> {
  const user = await dataSource.getRepository(UserEntity).findOneByOrFail({ id: userId });
  const member = await dataSource.getRepository(WorkspaceMemberEntity).findOneBy({ userId, workspaceId });

  return {
    id: user.id,
    email: user.email,
    isEmailVerified: user.isEmailVerified,
    firstName: member?.firstName || user.firstName,
    lastName: member?.lastName || user.lastName,
    avatarUrl: member?.avatarUrl ?? null,
    roleId: member?.roleId ?? null,
    colorScheme: member?.colorScheme ?? 'SYSTEM',
  };
}
