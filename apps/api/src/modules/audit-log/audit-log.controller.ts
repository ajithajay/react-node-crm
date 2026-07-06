import type { Request, Response } from 'express';
import type { AuditLogQuery } from '@saasly/shared';
import { list } from './audit-log.service.js';

export async function index(req: Request, res: Response): Promise<void> {
  // validate() has already replaced req.query with the parsed+coerced AuditLogQuery at runtime.
  const result = await list(req.workspaceId!, req.query as unknown as AuditLogQuery);
  res.status(200).json(result);
}
