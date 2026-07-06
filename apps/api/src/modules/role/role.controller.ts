import type { Request, Response } from 'express';
import { listRoles } from './role.service.js';

export async function index(req: Request, res: Response): Promise<void> {
  const result = await listRoles(req.workspaceId!);
  res.status(200).json(result);
}
