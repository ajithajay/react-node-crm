import type { NextFunction, Request, Response } from 'express';
import { ZodError, type ZodType } from 'zod';

export interface ValidationSchemas {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
}

/** Parses + replaces req.body/query/params in place; 400s with issue details on mismatch. */
export function validate(schemas: ValidationSchemas) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      // Express 5 exposes req.query/req.params as getters, so parsed results are set via
      // defineProperty rather than assignment (req.body remains a plain writable property).
      if (schemas.body) req.body = schemas.body.parse(req.body);
      if (schemas.query) {
        Object.defineProperty(req, 'query', { value: schemas.query.parse(req.query), writable: true });
      }
      if (schemas.params) {
        Object.defineProperty(req, 'params', { value: schemas.params.parse(req.params), writable: true });
      }
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        res.status(400).json({ error: 'ValidationError', issues: err.issues });
        return;
      }
      next(err);
    }
  };
}
