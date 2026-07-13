import express, { type Application } from 'express';
import cookieParser from 'cookie-parser';
import { pinoHttp } from 'pino-http';
import { logger } from './lib/logger.js';
import { corsMiddleware } from './middleware/cors.js';
import { requestContext } from './middleware/request-context.js';
import { errorHandler } from './middleware/error-handler.js';
import { healthRouter } from './modules/health/health.routes.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { userRouter } from './modules/user/user.routes.js';
import { workspaceRouter } from './modules/workspace/workspace.routes.js';
import { memberRouter } from './modules/member/member.routes.js';
import { fileRouter } from './modules/file/file.routes.js';
import { roleRouter } from './modules/role/role.routes.js';
import { auditLogRouter } from './modules/audit-log/audit-log.routes.js';
import { invitationAdminRouter, invitationPublicRouter } from './modules/invitation/invitation.routes.js';
import { dataModelRouter } from './modules/data-model/data-model.routes.js';
import { apiKeyRouter } from './modules/api-key/api-key.routes.js';
import { webhookRouter } from './modules/webhook/webhook.routes.js';
import { openApiRouter } from './modules/open-api/open-api.routes.js';
import { recordRouter } from './modules/record/record.routes.js';
import { viewRouter } from './modules/view/view.routes.js';
import { navigationRouter } from './modules/navigation/navigation.routes.js';
import { dashboardRouter } from './modules/dashboard/dashboard.routes.js';

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
  app.use('/views', viewRouter);
  app.use('/navigation', navigationRouter);
  app.use('/dashboards', dashboardRouter);

  app.use(errorHandler);

  return app;
}
