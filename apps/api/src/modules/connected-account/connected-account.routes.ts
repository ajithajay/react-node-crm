import { Router } from 'express';
import {
  createImapSmtpAccountRequestSchema,
  updateCalendarChannelRequestSchema,
  updateImapSmtpAccountRequestSchema,
  updateMessageChannelRequestSchema,
  updateMessageFoldersRequestSchema,
} from '@saasly/shared';
import { authGuard } from '../../middleware/auth-guard.js';
import { workspaceGuard } from '../../middleware/workspace-guard.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './connected-account.controller.js';

/**
 * Connected mailbox/calendar accounts for the current workspace member. Internal (session-auth)
 * only — these are per-user settings, not part of the public API-key surface.
 */
export const connectedAccountRouter: Router = Router();

connectedAccountRouter.get('/', authGuard, workspaceGuard, controller.index);
connectedAccountRouter.get('/:id', authGuard, workspaceGuard, controller.show);
connectedAccountRouter.delete('/:id', authGuard, workspaceGuard, controller.destroy);
connectedAccountRouter.post(
  '/imap-smtp',
  authGuard,
  workspaceGuard,
  validate({ body: createImapSmtpAccountRequestSchema }),
  controller.createImapSmtp,
);
connectedAccountRouter.patch(
  '/:id/imap-smtp',
  authGuard,
  workspaceGuard,
  validate({ body: updateImapSmtpAccountRequestSchema }),
  controller.updateImapSmtp,
);

/** Channel config lives under the same router for cohesion (all per-account settings). */
connectedAccountRouter.patch(
  '/message-channels/:id',
  authGuard,
  workspaceGuard,
  validate({ body: updateMessageChannelRequestSchema }),
  controller.updateMessageChannel,
);
connectedAccountRouter.patch(
  '/message-channels/:id/folders',
  authGuard,
  workspaceGuard,
  validate({ body: updateMessageFoldersRequestSchema }),
  controller.updateMessageFolders,
);
connectedAccountRouter.post('/message-channels/:id/sync', authGuard, workspaceGuard, controller.syncMessageChannel);
connectedAccountRouter.patch(
  '/calendar-channels/:id',
  authGuard,
  workspaceGuard,
  validate({ body: updateCalendarChannelRequestSchema }),
  controller.updateCalendarChannel,
);
connectedAccountRouter.post('/calendar-channels/:id/sync', authGuard, workspaceGuard, controller.syncCalendarChannel);
