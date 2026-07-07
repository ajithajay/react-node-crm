import type { Request, Response } from 'express';
import type { ReassignMemberRoleRequest } from '@saasly/shared';
import { listMembers, reassignRole } from './member.service.js';

export async function list(req: Request, res: Response): Promise<void> {
  const result = await listMembers(req.workspaceId!);
  res.status(200).json(result);
}

export async function updateRole(
  req: Request<{ id: string }, unknown, ReassignMemberRoleRequest>,
  res: Response,
): Promise<void> {
  await reassignRole(req.workspaceId!, req.params.id, req.user!.id, req.body.roleId);
  res.status(200).json({ ok: true });
}
