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
export * from './auth/token-type.js';
export * from './auth/subdomain.js';
export * from './auth/schemas.js';
export * from './queue/queue-name.js';
export * from './queue/email-job.js';
