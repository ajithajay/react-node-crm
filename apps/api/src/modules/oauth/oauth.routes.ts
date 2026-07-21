import { Router } from 'express';
import { authGuard } from '../../middleware/auth-guard.js';
import { workspaceGuard } from '../../middleware/workspace-guard.js';
import * as controller from './oauth.controller.js';

/**
 * Third-party OAuth (Gmail + Google Calendar). `init` is session-authed (binds workspace+member into
 * the signed state); `callback` is hit by Google's host-agnostic redirect, so it carries no session
 * and derives everything from the state token.
 */
export const oauthRouter: Router = Router();

oauthRouter.get('/google/init', authGuard, workspaceGuard, controller.googleInit);
oauthRouter.get('/google/callback', controller.googleCallback);
oauthRouter.get('/microsoft/init', authGuard, workspaceGuard, controller.microsoftInit);
