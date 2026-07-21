import type { Request, Response } from 'express';
import type { TimelineThreadsQuery } from '@saasly/shared';
import * as service from './calendar.service.js';

export async function events(req: Request, res: Response): Promise<void> {
  const { objectNameSingular, recordId } = req.query as unknown as TimelineThreadsQuery;
  const result = await service.listEvents(req.workspaceId!, objectNameSingular, recordId);
  res.status(200).json(result);
}
