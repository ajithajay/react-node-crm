/**
 * @saasly/shared — framework-agnostic contracts shared across web, api, and worker.
 * Holds zod schemas, inferred types, enums (field types, object names), constants, and pure utils.
 * MUST NOT import ORM or React.
 */

export const APP_NAME = 'saasly-crm' as const;

export type Brand<T, B extends string> = T & { readonly __brand: B };

export * from './env.js';
export * from './metadata/field-metadata-type.js';
export * from './metadata/field-metadata-settings.js';
export * from './metadata/identifier.js';
export * from './metadata/permission-flag.js';
export * from './metadata/view-type.js';
export * from './metadata/currencies.js';
export * from './auth/token-type.js';
export * from './auth/subdomain.js';
export * from './auth/schemas.js';
export * from './queue/queue-name.js';
export * from './queue/email-job.js';
export * from './queue/webhook-job.js';
export * from './queue/workflow-job.js';
export * from './user/schemas.js';
export * from './workspace/schemas.js';
export * from './audit-log/schemas.js';
export * from './invitation/schemas.js';
export * from './role/schemas.js';
export * from './role/row-level-permission-type.js';
export * from './data-model/schemas.js';
export * from './api-key/schemas.js';
export * from './webhook/schemas.js';
export * from './record/schemas.js';
export * from './search/schemas.js';
export * from './view/schemas.js';
export * from './navigation/schemas.js';
export * from './page-layout/schemas.js';
export * from './dashboard/schemas.js';
export * from './workflow/schemas.js';
export * from './workflow/variable-resolver.js';
export * from './workflow/conditions.js';
export * from './workflow/code-params.js';
export * from './utils/naming.js';
