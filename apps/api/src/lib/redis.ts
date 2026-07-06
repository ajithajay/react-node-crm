import { Redis } from 'ioredis';
import { env } from './config.js';

/** Lazy connection — first command (e.g. the health ping) establishes it. */
export const redis = new Redis(env.REDIS_URL, {
  lazyConnect: true,
  maxRetriesPerRequest: 1,
});
