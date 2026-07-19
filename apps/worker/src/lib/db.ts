import { createCoreDataSource, createWorkspaceDataSourceCache } from '@saasly/database';
import { env } from './config.js';

/** Core (control-plane) datasource — initialized in the worker bootstrap (index.ts). */
export const dataSource = createCoreDataSource(env.DATABASE_URL);

/** LRU-cached per-workspace DataSources, used by workflow record actions (mirrors the api). */
export const workspaceDataSourceCache = createWorkspaceDataSourceCache(dataSource, env.DATABASE_URL);
