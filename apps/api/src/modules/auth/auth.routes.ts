import { Router } from 'express';
import {
  signupRequestSchema,
  verifyEmailRequestSchema,
  passwordResetRequestSchema,
  passwordResetValidateSchema,
  passwordResetConfirmSchema,
  subdomainAvailabilityQuerySchema,
  loginRequestSchema,
  loginExchangeRequestSchema,
  twoFactorEnrollVerifyRequestSchema,
  twoFactorLoginVerifyRequestSchema,
} from '@saasly/shared';
import { validate } from '../../middleware/validate.js';
import { authGuard } from '../../middleware/auth-guard.js';
import { workspaceGuard } from '../../middleware/workspace-guard.js';
import { createWorkspaceWithTokenSchema, selectWorkspaceWithTokenSchema } from './auth.validation.js';
import * as authController from './auth.controller.js';

export const authRouter: Router = Router();

authRouter.post('/signup', validate({ body: signupRequestSchema }), authController.signup);
authRouter.post('/verify-email', validate({ body: verifyEmailRequestSchema }), authController.verifyEmail);

authRouter.post(
  '/password-reset/request',
  validate({ body: passwordResetRequestSchema }),
  authController.requestPasswordReset,
);
authRouter.post(
  '/password-reset/validate',
  validate({ body: passwordResetValidateSchema }),
  authController.validatePasswordResetToken,
);
authRouter.post(
  '/password-reset/confirm',
  validate({ body: passwordResetConfirmSchema }),
  authController.confirmPasswordReset,
);

authRouter.get(
  '/subdomain-availability',
  validate({ query: subdomainAvailabilityQuerySchema }),
  authController.subdomainAvailability,
);
authRouter.post(
  '/workspaces',
  validate({ body: createWorkspaceWithTokenSchema }),
  authController.createWorkspace,
);

authRouter.post(
  '/login',
  workspaceGuard,
  validate({ body: loginRequestSchema }),
  authController.loginWorkspaceScoped,
);
authRouter.post('/login/agnostic', validate({ body: loginRequestSchema }), authController.loginAgnostic);
authRouter.post(
  '/login/select-workspace',
  validate({ body: selectWorkspaceWithTokenSchema }),
  authController.selectWorkspace,
);
authRouter.post(
  '/login/exchange',
  validate({ body: loginExchangeRequestSchema }),
  authController.exchangeLoginToken,
);
authRouter.post(
  '/login/2fa/verify',
  validate({ body: twoFactorLoginVerifyRequestSchema }),
  authController.verifyLoginTwoFactor,
);

authRouter.post('/refresh', authController.refresh);
authRouter.post('/logout', authController.logout);

authRouter.post('/2fa/enroll', authGuard, authController.start2FAEnrollment);
authRouter.post(
  '/2fa/enroll/verify',
  authGuard,
  validate({ body: twoFactorEnrollVerifyRequestSchema }),
  authController.verify2FAEnrollment,
);
authRouter.post('/2fa/deactivate', authGuard, authController.deactivate2FA);
