import type { NextFunction, Request, Response } from 'express';
import { NotFoundError } from '../lib/errors.js';

export function workspaceGuard(req: Request, _res: Response, next: NextFunction): void {
  if (!req.workspace) {
    next(new NotFoundError('Workspace not found'));
    return;
  }
  next();
}
