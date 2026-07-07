import { extendZodWithOpenApi, OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import {
  createApiKeyRequestSchema,
  createFieldRequestSchema,
  createIndexRequestSchema,
  createInvitationRequestSchema,
  createMorphRelationRequestSchema,
  createObjectRequestSchema,
  createRelationRequestSchema,
  createRoleRequestSchema,
  createWebhookRequestSchema,
  reassignMemberRoleRequestSchema,
  setActiveRequestSchema,
  setObjectIdentifiersRequestSchema,
  updateFieldRequestSchema,
  updateObjectRequestSchema,
  updatePreferencesRequestSchema,
  updateProfileRequestSchema,
  updateWebhookRequestSchema,
  updateWorkspaceRequestSchema,
} from '@saasly/shared';

extendZodWithOpenApi(z);

export type OpenApiSchemaName = 'core' | 'metadata';

const idParam = z.object({ id: z.string().uuid() });
const fieldParams = z.object({ id: z.string().uuid(), fieldId: z.string().uuid() });
const indexParams = z.object({ id: z.string().uuid(), indexId: z.string().uuid() });
const ok = (description = 'OK') => ({ description });
const jsonBody = (schema: z.ZodTypeAny) => ({ content: { 'application/json': { schema } } });

/** Registers the shared bearer security scheme and returns the `security` array to attach to routes. */
function setupSecurity(registry: OpenAPIRegistry): { auth: Record<string, string[]>[] } {
  const bearerAuth = registry.registerComponent('securitySchemes', 'bearerAuth', {
    type: 'http',
    scheme: 'bearer',
  });
  return { auth: [{ [bearerAuth.name]: [] }] };
}

/** Core API — identity, workspace, members/roles, keys/webhooks (Twenty's "core" REST surface). */
function registerCoreRoutes(registry: OpenAPIRegistry): void {
  const { auth } = setupSecurity(registry);

  registry.registerPath({
    method: 'get',
    path: '/health',
    tags: ['Health'],
    summary: 'Liveness check (DB + Redis)',
    responses: { 200: ok() },
  });

  registry.registerPath({
    method: 'get',
    path: '/users/me',
    tags: ['Users'],
    summary: 'Current user profile',
    security: auth,
    responses: { 200: ok() },
  });
  registry.registerPath({
    method: 'patch',
    path: '/users/me',
    tags: ['Users'],
    summary: 'Update first/last name',
    security: auth,
    request: { body: jsonBody(updateProfileRequestSchema) },
    responses: { 200: ok() },
  });
  registry.registerPath({
    method: 'patch',
    path: '/users/me/preferences',
    tags: ['Users'],
    summary: 'Update appearance/format preferences',
    security: auth,
    request: { body: jsonBody(updatePreferencesRequestSchema) },
    responses: { 200: ok() },
  });

  registry.registerPath({
    method: 'get',
    path: '/workspace',
    tags: ['Workspace'],
    summary: 'Current workspace',
    security: auth,
    responses: { 200: ok() },
  });
  registry.registerPath({
    method: 'patch',
    path: '/workspace',
    tags: ['Workspace'],
    summary: 'Update workspace name/subdomain',
    security: auth,
    request: { body: jsonBody(updateWorkspaceRequestSchema) },
    responses: { 200: ok() },
  });

  registry.registerPath({
    method: 'get',
    path: '/members',
    tags: ['Members'],
    summary: 'List workspace members',
    security: auth,
    responses: { 200: ok() },
  });
  registry.registerPath({
    method: 'patch',
    path: '/members/{id}/role',
    tags: ['Members'],
    summary: "Reassign a member's role",
    security: auth,
    request: { params: idParam, body: jsonBody(reassignMemberRoleRequestSchema) },
    responses: { 200: ok() },
  });

  registry.registerPath({
    method: 'get',
    path: '/members/invitations',
    tags: ['Invitations'],
    summary: 'List invitations',
    security: auth,
    responses: { 200: ok() },
  });
  registry.registerPath({
    method: 'post',
    path: '/members/invitations',
    tags: ['Invitations'],
    summary: 'Invite a member by email',
    security: auth,
    request: { body: jsonBody(createInvitationRequestSchema) },
    responses: { 201: ok('Created') },
  });
  registry.registerPath({
    method: 'delete',
    path: '/members/invitations/{id}',
    tags: ['Invitations'],
    summary: 'Revoke an invitation',
    security: auth,
    request: { params: idParam },
    responses: { 200: ok() },
  });

  registry.registerPath({
    method: 'get',
    path: '/roles',
    tags: ['Roles'],
    summary: 'List roles',
    security: auth,
    responses: { 200: ok() },
  });
  registry.registerPath({
    method: 'get',
    path: '/roles/{id}',
    tags: ['Roles'],
    summary: 'Get a role',
    security: auth,
    request: { params: idParam },
    responses: { 200: ok() },
  });
  registry.registerPath({
    method: 'post',
    path: '/roles',
    tags: ['Roles'],
    summary: 'Create a role',
    security: auth,
    request: { body: jsonBody(createRoleRequestSchema) },
    responses: { 201: ok('Created') },
  });
  registry.registerPath({
    method: 'delete',
    path: '/roles/{id}',
    tags: ['Roles'],
    summary: 'Delete a role',
    security: auth,
    request: { params: idParam },
    responses: { 200: ok() },
  });

  registry.registerPath({
    method: 'get',
    path: '/audit-logs',
    tags: ['Audit Logs'],
    summary: 'List audit log entries',
    security: auth,
    request: {
      query: z.object({
        action: z.string().optional(),
        page: z.string().optional(),
        pageSize: z.string().optional(),
      }),
    },
    responses: { 200: ok() },
  });

  registry.registerPath({
    method: 'get',
    path: '/api-keys',
    tags: ['API Keys'],
    summary: 'List API keys',
    security: auth,
    responses: { 200: ok() },
  });
  registry.registerPath({
    method: 'post',
    path: '/api-keys',
    tags: ['API Keys'],
    summary: 'Create an API key',
    security: auth,
    request: { body: jsonBody(createApiKeyRequestSchema) },
    responses: { 201: ok('Created — the raw token is only ever returned here') },
  });
  registry.registerPath({
    method: 'delete',
    path: '/api-keys/{id}',
    tags: ['API Keys'],
    summary: 'Revoke an API key',
    security: auth,
    request: { params: idParam },
    responses: { 200: ok() },
  });

  registry.registerPath({
    method: 'get',
    path: '/webhooks',
    tags: ['Webhooks'],
    summary: 'List webhooks',
    security: auth,
    responses: { 200: ok() },
  });
  registry.registerPath({
    method: 'post',
    path: '/webhooks',
    tags: ['Webhooks'],
    summary: 'Create a webhook',
    security: auth,
    request: { body: jsonBody(createWebhookRequestSchema) },
    responses: { 201: ok('Created') },
  });
  registry.registerPath({
    method: 'patch',
    path: '/webhooks/{id}',
    tags: ['Webhooks'],
    summary: 'Update a webhook',
    security: auth,
    request: { params: idParam, body: jsonBody(updateWebhookRequestSchema) },
    responses: { 200: ok() },
  });
  registry.registerPath({
    method: 'post',
    path: '/webhooks/{id}/regenerate-secret',
    tags: ['Webhooks'],
    summary: 'Regenerate the signing secret',
    security: auth,
    request: { params: idParam },
    responses: { 200: ok() },
  });
  registry.registerPath({
    method: 'delete',
    path: '/webhooks/{id}',
    tags: ['Webhooks'],
    summary: 'Delete a webhook',
    security: auth,
    request: { params: idParam },
    responses: { 200: ok() },
  });
}

/** Metadata API — objects/fields/relations/indexes data-model management (Twenty's "metadata" REST surface). */
function registerMetadataRoutes(registry: OpenAPIRegistry): void {
  const { auth } = setupSecurity(registry);

  registry.registerPath({
    method: 'get',
    path: '/data-model/objects',
    tags: ['Objects'],
    summary: 'List objects',
    security: auth,
    responses: { 200: ok() },
  });
  registry.registerPath({
    method: 'get',
    path: '/data-model/objects/{id}',
    tags: ['Objects'],
    summary: 'Get an object (fields + indexes)',
    security: auth,
    request: { params: idParam },
    responses: { 200: ok() },
  });
  registry.registerPath({
    method: 'post',
    path: '/data-model/objects',
    tags: ['Objects'],
    summary: 'Create a custom object',
    security: auth,
    request: { body: jsonBody(createObjectRequestSchema) },
    responses: { 201: ok('Created') },
  });
  registry.registerPath({
    method: 'patch',
    path: '/data-model/objects/{id}',
    tags: ['Objects'],
    summary: 'Update an object',
    security: auth,
    request: { params: idParam, body: jsonBody(updateObjectRequestSchema) },
    responses: { 200: ok() },
  });
  registry.registerPath({
    method: 'patch',
    path: '/data-model/objects/{id}/active',
    tags: ['Objects'],
    summary: 'Activate / deactivate an object',
    security: auth,
    request: { params: idParam, body: jsonBody(setActiveRequestSchema) },
    responses: { 200: ok() },
  });
  registry.registerPath({
    method: 'patch',
    path: '/data-model/objects/{id}/identifiers',
    tags: ['Objects'],
    summary: 'Set record label / image identifier fields',
    security: auth,
    request: { params: idParam, body: jsonBody(setObjectIdentifiersRequestSchema) },
    responses: { 200: ok() },
  });
  registry.registerPath({
    method: 'delete',
    path: '/data-model/objects/{id}',
    tags: ['Objects'],
    summary: 'Delete a custom object',
    security: auth,
    request: { params: idParam },
    responses: { 200: ok() },
  });

  registry.registerPath({
    method: 'post',
    path: '/data-model/objects/{id}/fields',
    tags: ['Fields'],
    summary: 'Create a field',
    security: auth,
    request: { params: idParam, body: jsonBody(createFieldRequestSchema) },
    responses: { 201: ok('Created') },
  });
  registry.registerPath({
    method: 'patch',
    path: '/data-model/objects/{id}/fields/{fieldId}',
    tags: ['Fields'],
    summary: 'Update a field',
    security: auth,
    request: { params: fieldParams, body: jsonBody(updateFieldRequestSchema) },
    responses: { 200: ok() },
  });
  registry.registerPath({
    method: 'patch',
    path: '/data-model/objects/{id}/fields/{fieldId}/active',
    tags: ['Fields'],
    summary: 'Activate / deactivate a field',
    security: auth,
    request: { params: fieldParams, body: jsonBody(setActiveRequestSchema) },
    responses: { 200: ok() },
  });
  registry.registerPath({
    method: 'delete',
    path: '/data-model/objects/{id}/fields/{fieldId}',
    tags: ['Fields'],
    summary: 'Delete a custom field',
    security: auth,
    request: { params: fieldParams },
    responses: { 200: ok() },
  });

  registry.registerPath({
    method: 'post',
    path: '/data-model/objects/{id}/relations',
    tags: ['Relations'],
    summary: 'Create a relation (both sides)',
    security: auth,
    request: { params: idParam, body: jsonBody(createRelationRequestSchema) },
    responses: { 201: ok('Created') },
  });
  registry.registerPath({
    method: 'post',
    path: '/data-model/objects/{id}/morph-relations',
    tags: ['Relations'],
    summary: 'Create a polymorphic (morph) relation',
    security: auth,
    request: { params: idParam, body: jsonBody(createMorphRelationRequestSchema) },
    responses: { 201: ok('Created') },
  });

  registry.registerPath({
    method: 'post',
    path: '/data-model/objects/{id}/indexes',
    tags: ['Indexes'],
    summary: 'Create an index',
    security: auth,
    request: { params: idParam, body: jsonBody(createIndexRequestSchema) },
    responses: { 201: ok('Created') },
  });
  registry.registerPath({
    method: 'delete',
    path: '/data-model/objects/{id}/indexes/{indexId}',
    tags: ['Indexes'],
    summary: 'Delete an index',
    security: auth,
    request: { params: indexParams },
    responses: { 200: ok() },
  });
}

/** Fresh registry per request — the generator consumes definitions, so we don't share one globally. */
export function buildRegistry(schema: OpenApiSchemaName): OpenAPIRegistry {
  const registry = new OpenAPIRegistry();
  if (schema === 'metadata') registerMetadataRoutes(registry);
  else registerCoreRoutes(registry);
  return registry;
}
