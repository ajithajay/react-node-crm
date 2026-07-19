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

/** Settings → Experience. No language/locale support. */
export const ColorSchemeValue = z.enum(['LIGHT', 'DARK', 'SYSTEM']);
export type ColorSchemeValue = z.infer<typeof ColorSchemeValue>;

export const DateFormatValue = z.enum(['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD']);
export type DateFormatValue = z.infer<typeof DateFormatValue>;

export const TimeFormatValue = z.enum(['HH:mm', 'hh:mm A']);
export type TimeFormatValue = z.infer<typeof TimeFormatValue>;

/** Thousands/decimal separator style, e.g. "1,000.00" = comma-thousands, dot-decimal. */
export const NumberFormatValue = z.enum(['1,000.00', '1.000,00', '1 000.00']);
export type NumberFormatValue = z.infer<typeof NumberFormatValue>;

export const updatePreferencesRequestSchema = z.object({
  colorScheme: ColorSchemeValue,
  timeZone: z.string().min(1).max(100),
  dateFormat: DateFormatValue,
  timeFormat: TimeFormatValue,
  numberFormat: NumberFormatValue,
});
export type UpdatePreferencesRequest = z.infer<typeof updatePreferencesRequestSchema>;
