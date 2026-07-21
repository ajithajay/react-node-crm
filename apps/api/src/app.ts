import express, { type Application } from 'express';
import cookieParser from 'cookie-parser';
import { pinoHttp } from 'pino-http';
import { logger } from './lib/logger.js';
import { corsMiddleware } from './middleware/cors.js';
import { requestContext } from './middleware/request-context.js';
import { workspaceRateLimit } from './middleware/rate-limit.js';
import { errorHandler } from './middleware/error-handler.js';
import { healthRouter } from './modules/health/health.routes.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { userRouter } from './modules/user/user.routes.js';
import { workspaceRouter, workspaceApiV1Router } from './modules/workspace/workspace.routes.js';
import { memberRouter, memberApiV1Router } from './modules/member/member.routes.js';
import { fileRouter, fileApiV1Router } from './modules/file/file.routes.js';
import { roleRouter } from './modules/role/role.routes.js';
import { auditLogRouter } from './modules/audit-log/audit-log.routes.js';
import {
  invitationAdminRouter,
  invitationPublicRouter,
  invitationApiV1Router,
} from './modules/invitation/invitation.routes.js';
import { dataModelRouter, dataModelApiV1Router } from './modules/data-model/data-model.routes.js';
import { apiKeyRouter } from './modules/api-key/api-key.routes.js';
import { webhookRouter, webhookApiV1Router } from './modules/webhook/webhook.routes.js';
import { openApiRouter } from './modules/open-api/open-api.routes.js';
import { recordRouter, recordApiV1Router } from './modules/record/record.routes.js';
import { viewRouter } from './modules/view/view.routes.js';
import { navigationRouter } from './modules/navigation/navigation.routes.js';
import { dashboardRouter } from './modules/dashboard/dashboard.routes.js';
import { workflowRouter } from './modules/workflow/workflow.routes.js';
import { workflowTriggerRouter } from './modules/workflow/workflow-trigger.routes.js';
import { searchRouter } from './modules/search/search.routes.js';
import { connectedAccountRouter } from './modules/connected-account/connected-account.routes.js';
import { messagingRouter } from './modules/messaging/messaging.routes.js';
import { oauthRouter } from './modules/oauth/oauth.routes.js';
import { calendarRouter } from './modules/calendar/calendar.routes.js';

export function createApp(): Application {
  const app = express();

  app.use(pinoHttp({ logger }));
  app.use(corsMiddleware);
  app.use(express.json());
  app.use(cookieParser());
  app.use(requestContext);

  app.use('/health', healthRouter);
  app.use('/auth', authRouter);
  app.use('/users', userRouter);
  app.use('/workspace', workspaceRouter);
  app.use('/members', memberRouter);
  app.use('/files', fileRouter);
  app.use('/roles', roleRouter);
  app.use('/audit-logs', auditLogRouter);
  app.use('/members/invitations', invitationAdminRouter);
  app.use('/invitations', invitationPublicRouter);
  app.use('/data-model', dataModelRouter);
  app.use('/api-keys', apiKeyRouter);
  app.use('/webhooks', webhookRouter);
  app.use('/open-api', openApiRouter);
  app.use('/rest', recordRouter);
  app.use('/search', searchRouter);
  app.use('/connected-accounts', connectedAccountRouter);
  app.use('/messaging', messagingRouter);
  app.use('/oauth', oauthRouter);
  app.use('/calendar', calendarRouter);

  // External REST API (v1) — API-key auth only, workspace-level rate limit. Specific resource
  // routers are mounted before the generic `recordApiV1Router` catch-all (`/:objectNamePlural`)
  // so e.g. `/api/v1/objects` reaches data-model, not a workspace object literally named "objects".
  // dataModelApiV1Router's own routes already start with `/objects`, so it mounts at the bare `/api/v1`.
  app.use('/api/v1', workspaceRateLimit, dataModelApiV1Router);
  app.use('/api/v1/members', workspaceRateLimit, memberApiV1Router);
  app.use('/api/v1/invitations', workspaceRateLimit, invitationApiV1Router);
  app.use('/api/v1/webhooks', workspaceRateLimit, webhookApiV1Router);
  app.use('/api/v1/workspace', workspaceRateLimit, workspaceApiV1Router);
  app.use('/api/v1/files', workspaceRateLimit, fileApiV1Router);
  app.use('/api/v1', workspaceRateLimit, recordApiV1Router);
  app.use('/views', viewRouter);
  app.use('/navigation', navigationRouter);
  app.use('/dashboards', dashboardRouter);
  app.use('/workflows', workflowRouter);
  app.use('/triggers', workflowTriggerRouter);

  app.use(errorHandler);

  return app;
}
