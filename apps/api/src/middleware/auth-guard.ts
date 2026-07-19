import type { NextFunction, Request, Response } from 'express';
import { UnauthorizedError } from '../lib/errors.js';

export function authGuard(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) {
    next(new UnauthorizedError());
    return;
  }
  next();
}

/** Requires an API-key bearer token specifically — used by the external /api/v1 REST surface. */
export function apiKeyGuard(req: Request, _res: Response, next: NextFunction): void {
  if (!req.apiKey) {
    next(new UnauthorizedError('API key required'));
    return;
  }
  next();
}
