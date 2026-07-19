import { createWorkspaceDataSourceCache } from '@saasly/database';
import { env } from './config.js';
import { dataSource } from './db.js';

/** LRU-cached per-workspace DataSources, backing the generic record API. */
export const workspaceDataSourceCache = createWorkspaceDataSourceCache(dataSource, env.DATABASE_URL);
