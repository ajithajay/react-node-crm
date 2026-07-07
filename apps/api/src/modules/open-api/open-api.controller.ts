import type { Request, Response } from 'express';
import { NotFoundError } from '../../lib/errors.js';
import type { OpenApiSchemaName } from './open-api.registry.js';
import { buildOpenApiDocument } from './open-api.service.js';

const SCHEMAS: OpenApiSchemaName[] = ['core', 'metadata'];

export function getSpec(req: Request<{ schema: string }>, res: Response): void {
  const schema = req.params.schema as OpenApiSchemaName;
  if (!SCHEMAS.includes(schema)) throw new NotFoundError('Unknown API schema');
  res.status(200).json(buildOpenApiDocument(schema));
}
