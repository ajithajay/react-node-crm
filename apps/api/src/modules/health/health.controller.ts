import type { Request, Response } from 'express';
import { checkHealth } from './health.service.js';

export async function getHealth(_req: Request, res: Response): Promise<void> {
  const result = await checkHealth();
  res.status(result.status === 'ok' ? 200 : 503).json(result);
}
