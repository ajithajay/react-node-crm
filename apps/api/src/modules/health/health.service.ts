import { dataSource } from '../../lib/db.js';
import { redis } from '../../lib/redis.js';

export interface HealthResult {
  status: 'ok' | 'degraded';
  db: boolean;
  redis: boolean;
  uptime: number;
}

async function checkDb(): Promise<boolean> {
  try {
    await dataSource.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

async function checkRedis(): Promise<boolean> {
  try {
    const reply = await redis.ping();
    return reply === 'PONG';
  } catch {
    return false;
  }
}

export async function checkHealth(): Promise<HealthResult> {
  const [db, cache] = await Promise.all([checkDb(), checkRedis()]);
  return {
    status: db && cache ? 'ok' : 'degraded',
    db,
    redis: cache,
    uptime: process.uptime(),
  };
}
