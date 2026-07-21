import { Router } from 'express';
import { sendMessageRequestSchema, timelineThreadsQuerySchema } from '@saasly/shared';
import { authGuard } from '../../middleware/auth-guard.js';
import { workspaceGuard } from '../../middleware/workspace-guard.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './messaging.controller.js';

/** Email threads surfaced on Person/Company/Opportunity records (internal, session-auth). */
export const messagingRouter: Router = Router();

messagingRouter.get(
  '/threads',
  authGuard,
  workspaceGuard,
  validate({ query: timelineThreadsQuerySchema }),
  controller.threads,
);
messagingRouter.get('/threads/:id', authGuard, workspaceGuard, controller.thread);
messagingRouter.post(
  '/send',
  authGuard,
  workspaceGuard,
  validate({ body: sendMessageRequestSchema }),
  controller.send,
);
