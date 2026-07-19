import { OpenApiGeneratorV31 } from '@asteasolutions/zod-to-openapi';
import type { OpenAPIObject } from 'openapi3-ts/oas31';
import { buildRegistry, type OpenApiSchemaName } from './open-api.registry.js';

const TITLES: Record<OpenApiSchemaName, string> = {
  core: 'Saasly CRM — Core API',
  metadata: 'Saasly CRM — Metadata API',
  v1: 'Saasly CRM — External REST API (v1)',
};

const DESCRIPTIONS: Record<OpenApiSchemaName, string> = {
  core: 'Identity, workspace, members, roles, API keys and webhooks.',
  metadata: 'Data-model management — objects, fields, relations and indexes.',
  v1: 'Generic per-workspace object CRUD for external integrations. API-key auth only.',
};

const SERVER_PATHS: Record<OpenApiSchemaName, string> = { core: '/', metadata: '/', v1: '/api/v1' };

/**
 * Three schemas: Core / Metadata (mirroring Twenty's split) plus v1 (the external, API-key-only
 * REST surface). The document is hand-registered per route (see open-api.registry.ts) since this
 * project is plain Express, not decorator-driven NestJS. Core/Metadata are static across
 * workspaces; v1 documents the one generic per-object CRUD shape rather than a route per object,
 * since object names are dynamic per workspace.
 */
export function buildOpenApiDocument(schema: OpenApiSchemaName): OpenAPIObject {
  const generator = new OpenApiGeneratorV31(buildRegistry(schema).definitions);
  return generator.generateDocument({
    openapi: '3.1.0',
    info: { title: TITLES[schema], version: '1.0.0', description: DESCRIPTIONS[schema] },
    servers: [{ url: SERVER_PATHS[schema] }],
  });
}
