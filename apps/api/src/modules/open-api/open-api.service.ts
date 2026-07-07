import { OpenApiGeneratorV31 } from '@asteasolutions/zod-to-openapi';
import type { OpenAPIObject } from 'openapi3-ts/oas31';
import { buildRegistry, type OpenApiSchemaName } from './open-api.registry.js';

const TITLES: Record<OpenApiSchemaName, string> = {
  core: 'Saasly CRM — Core API',
  metadata: 'Saasly CRM — Metadata API',
};

const DESCRIPTIONS: Record<OpenApiSchemaName, string> = {
  core: 'Identity, workspace, members, roles, API keys and webhooks.',
  metadata: 'Data-model management — objects, fields, relations and indexes.',
};

/**
 * Two schemas, mirroring Twenty's Core / Metadata split. The document is hand-registered per route
 * (see open-api.registry.ts) since this project is plain Express, not decorator-driven NestJS.
 * Static across workspaces for now: covers the fixed routes built so far, not per-workspace dynamic
 * object/record paths — those don't exist until Phase 6's generic record CRUD.
 */
export function buildOpenApiDocument(schema: OpenApiSchemaName): OpenAPIObject {
  const generator = new OpenApiGeneratorV31(buildRegistry(schema).definitions);
  return generator.generateDocument({
    openapi: '3.1.0',
    info: { title: TITLES[schema], version: '1.0.0', description: DESCRIPTIONS[schema] },
    servers: [{ url: '/' }],
  });
}
