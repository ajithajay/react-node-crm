import type { NextFunction, Request, Response } from 'express';
import { UnauthorizedError } from '../lib/errors.js';

export function authGuard(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) {
    next(new UnauthorizedError());
    return;
  }
  next();
}
