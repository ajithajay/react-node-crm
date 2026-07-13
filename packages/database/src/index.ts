/**
 * @saasly/database — TypeORM datasources (core + per-workspace factory), core entities,
 * metadata entities, the metadata→DDL engine, dynamic EntitySchema factory, migrations, and
 * standard-object seed definitions. Consumed by @saasly/api and @saasly/worker.
 */

import { APP_NAME } from '@saasly/shared';

export const DATABASE_PACKAGE = `${APP_NAME}:database` as const;

export * from './data-source.js';
export * from './entities/index.js';
export * from './workspace-schema/schema-name.util.js';
export * from './workspace-schema/workspace-schema.service.js';
export * from './metadata/metadata.service.js';
export * from './ddl/field-column-mapper.js';
export * from './workspace-entity/entity-schema.factory.js';
export * from './workspace-entity/workspace-datasource-cache.js';
export * from './workspace-manager/standard-objects.seed.js';
export * from './workspace-manager/standard-roles.seed.js';
export * from './workspace-manager/page-layout.seed.js';
export * from './workspace-manager/dashboard.seed.js';
export * from './workspace-manager/workspace-manager.service.js';
