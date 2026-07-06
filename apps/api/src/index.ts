import { ensureCoreSchema, runCoreMigrations } from '@saasly/database';
import { env } from './lib/config.js';
import { logger } from './lib/logger.js';
import { dataSource } from './lib/db.js';
import { createApp } from './app.js';

async function main(): Promise<void> {
  await dataSource.initialize();
  await ensureCoreSchema(dataSource);
  await runCoreMigrations(dataSource);
  logger.info('core datasource ready (schema: core)');

  const app = createApp();
  app.listen(env.API_PORT, () => {
    logger.info(`[api] listening on http://localhost:${env.API_PORT}`);
  });
}

main().catch((err) => {
  logger.error({ err }, '[api] failed to start');
  process.exit(1);
});
