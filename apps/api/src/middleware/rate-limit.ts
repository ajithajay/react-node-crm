import type { NextFunction, Request, Response } from 'express';
import { env } from '../lib/config.js';
import { redis } from '../lib/redis.js';
import { TooManyRequestsError, UnauthorizedError } from '../lib/errors.js';

/**
 * Fixed-window counter keyed by workspace (not by API key — a workspace's callers share one
 * budget regardless of how many keys they use), backed by the same Redis instance used for
 * BullMQ. Runs before `apiKeyGuard`, so it needs only `req.workspaceId`, which `requestContext`
 * resolves from the Host header for every request.
 */
export async function workspaceRateLimit(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.workspaceId) {
    next(new UnauthorizedError());
    return;
  }

  try {
    const windowStart = Math.floor(Date.now() / 60_000);
    const key = `ratelimit:workspace:${req.workspaceId}:${windowStart}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, 60);

    const limit = env.PUBLIC_API_RATE_LIMIT_PER_MIN;
    res.setHeader('X-RateLimit-Limit', String(limit));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, limit - count)));

    if (count > limit) {
      next(new TooManyRequestsError());
      return;
    }
    next();
  } catch (err) {
    next(err);
  }
}
