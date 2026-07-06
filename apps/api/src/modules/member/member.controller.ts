import type { Request, Response } from 'express';
import { listMembers } from './member.service.js';

export async function list(req: Request, res: Response): Promise<void> {
  const result = await listMembers(req.workspaceId!);
  res.status(200).json(result);
}
