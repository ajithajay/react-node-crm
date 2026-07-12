import type { NextFunction, Request, Response } from 'express';
import { UnauthorizedError } from '../lib/errors.js';

export function authGuard(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) {
    next(new UnauthorizedError());
    return;
  }
  next();
}

/** Allows either a logged-in user or an API-key bearer token — used by the generic /rest API (gap E3). */
export function restAuthGuard(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user && !req.apiKey) {
    next(new UnauthorizedError());
    return;
  }
  next();
}
