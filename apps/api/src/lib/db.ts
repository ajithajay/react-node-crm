import { createCoreDataSource } from '@saasly/database';
import { env } from './config.js';

/** The core (control-plane) datasource. Initialized in the bootstrap (index.ts). */
export const dataSource = createCoreDataSource(env.DATABASE_URL);
