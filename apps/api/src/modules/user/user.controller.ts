import type { Request, Response } from 'express';
import { getMe } from './user.service.js';

export async function me(req: Request, res: Response): Promise<void> {
  const result = await getMe(req.user!.id, req.workspaceId!);
  res.status(200).json(result);
}
