import type { Request, Response } from 'express';
import type { SearchQuery } from '@saasly/shared';
import { principalOf } from '../../lib/principal.js';
import { searchWorkspace } from './search.service.js';

export async function search(req: Request<unknown, unknown, unknown, SearchQuery>, res: Response): Promise<void> {
  const results = await searchWorkspace(req.workspaceId!, principalOf(req), req.query.q);
  res.status(200).json(results);
}
