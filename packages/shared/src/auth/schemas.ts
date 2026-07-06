import { z } from 'zod';
import { isReservedSubdomain, isValidSubdomainFormat } from './subdomain.js';

export const emailSchema = z.string().trim().toLowerCase().email();
export const passwordSchema = z.string().min(8).max(128);

export const subdomainSchema = z
  .string()
  .trim()
  .toLowerCase()
  .refine(isValidSubdomainFormat, {
    message: 'Subdomain must be 3-63 lowercase alphanumeric characters or hyphens',
  });

export const signupRequestSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});
export type SignupRequest = z.infer<typeof signupRequestSchema>;

export const verifyEmailRequestSchema = z.object({ token: z.string().min(1) });
export type VerifyEmailRequest = z.infer<typeof verifyEmailRequestSchema>;

export const passwordResetRequestSchema = z.object({ email: emailSchema });
export type PasswordResetRequest = z.infer<typeof passwordResetRequestSchema>;

export const passwordResetValidateSchema = z.object({ token: z.string().min(1) });
export type PasswordResetValidateRequest = z.infer<typeof passwordResetValidateSchema>;

export const passwordResetConfirmSchema = z.object({
  token: z.string().min(1),
  password: passwordSchema,
});
export type PasswordResetConfirmRequest = z.infer<typeof passwordResetConfirmSchema>;

export const subdomainAvailabilityQuerySchema = z.object({ subdomain: z.string().min(1) });
export type SubdomainAvailabilityQuery = z.infer<typeof subdomainAvailabilityQuerySchema>;

export const createWorkspaceRequestSchema = z.object({
  name: z.string().trim().min(1).max(100),
  subdomain: subdomainSchema,
  logoUrl: z.string().url().nullish(),
});
export type CreateWorkspaceRequest = z.infer<typeof createWorkspaceRequestSchema>;

export const loginRequestSchema = z.object({
  email: emailSchema,
  password: z.string().min(1),
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const loginExchangeRequestSchema = z.object({ token: z.string().min(1) });
export type LoginExchangeRequest = z.infer<typeof loginExchangeRequestSchema>;

export const selectWorkspaceRequestSchema = z.object({ workspaceId: z.string().uuid() });
export type SelectWorkspaceRequest = z.infer<typeof selectWorkspaceRequestSchema>;

export const twoFactorEnrollVerifyRequestSchema = z.object({
  code: z.string().length(6),
});
export type TwoFactorEnrollVerifyRequest = z.infer<typeof twoFactorEnrollVerifyRequestSchema>;

export const twoFactorLoginVerifyRequestSchema = z.object({
  challengeToken: z.string().min(1),
  code: z.string().length(6),
});
export type TwoFactorLoginVerifyRequest = z.infer<typeof twoFactorLoginVerifyRequestSchema>;

/** Reserved-name check kept separate from format so callers can message the two failures distinctly. */
export { isReservedSubdomain, isValidSubdomainFormat };
