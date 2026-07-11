import { createWorkspaceDataSourceCache } from '@saasly/database';
import { env } from './config.js';
import { dataSource } from './db.js';

/** LRU-cached per-workspace DataSources (solution-approach.md §4.6), backing the generic record API. */
export const workspaceDataSourceCache = createWorkspaceDataSourceCache(dataSource, env.DATABASE_URL);
