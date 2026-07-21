import { Router } from 'express';
import { timelineThreadsQuerySchema } from '@saasly/shared';
import { authGuard } from '../../middleware/auth-guard.js';
import { workspaceGuard } from '../../middleware/workspace-guard.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './calendar.controller.js';

/** Read-only calendar events surfaced on Person/Company/Opportunity records. */
export const calendarRouter: Router = Router();

calendarRouter.get(
  '/events',
  authGuard,
  workspaceGuard,
  validate({ query: timelineThreadsQuerySchema }),
  controller.events,
);
