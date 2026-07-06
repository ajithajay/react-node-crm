import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../lib/errors.js';

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  req.log?.error({ err }, 'unhandled error');
  res.status(500).json({ error: 'Internal Server Error' });
}
