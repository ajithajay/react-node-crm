import type { Request, Response } from 'express';
import { getCurrentWorkspace } from './workspace.service.js';

export async function current(req: Request, res: Response): Promise<void> {
  const result = await getCurrentWorkspace(req.workspaceId!);
  res.status(200).json(result);
}
