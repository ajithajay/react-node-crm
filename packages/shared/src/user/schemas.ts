import { z } from 'zod';
import { passwordSchema } from '../auth/schemas.js';

export const updateProfileRequestSchema = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
});
export type UpdateProfileRequest = z.infer<typeof updateProfileRequestSchema>;

export const changePasswordRequestSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
});
export type ChangePasswordRequest = z.infer<typeof changePasswordRequestSchema>;

export const deleteAccountRequestSchema = z.object({
  password: z.string().min(1),
});
export type DeleteAccountRequest = z.infer<typeof deleteAccountRequestSchema>;
