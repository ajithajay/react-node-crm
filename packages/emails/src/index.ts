/**
 * @saasly/emails — React Email templates (verify, invite, password-reset, password-changed).
 * Rendered to HTML by @saasly/api / @saasly/worker. JSX (.tsx) templates are added in Phase 3.
 */

import { APP_NAME } from '@saasly/shared';

export const EMAILS_PACKAGE = `${APP_NAME}:emails` as const;

export * from './render.js';
export * from './templates/verify-email.js';
export * from './templates/password-reset.js';
export * from './templates/password-changed.js';
export * from './templates/invite-link.js';
