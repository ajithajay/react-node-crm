import { Router } from 'express';
import { searchQuerySchema } from '@saasly/shared';
import { authGuard } from '../../middleware/auth-guard.js';
import { workspaceGuard } from '../../middleware/workspace-guard.js';
import { validate } from '../../middleware/validate.js';
import * as searchController from './search.controller.js';

/** Cross-object quick-jump search, powering the ⌘K command menu — logged-in workspace members only. */
export const searchRouter: Router = Router();

searchRouter.get('/', authGuard, workspaceGuard, validate({ query: searchQuerySchema }), searchController.search);
