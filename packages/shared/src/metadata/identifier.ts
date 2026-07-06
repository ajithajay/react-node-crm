import { z } from 'zod';

/**
 * snake_case identifier rule for object/field `name` — becomes a Postgres table/column name.
 * Must start with a lowercase letter; letters, digits, underscores only. Kept short of Postgres's
 * 63-byte identifier limit to leave room for composite-field column suffixes (e.g. `<name>AmountMicros`).
 */
export const IDENTIFIER_REGEX = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/;
export const IDENTIFIER_MAX_LENGTH = 40;

export const identifierSchema = z
  .string()
  .min(1)
  .max(IDENTIFIER_MAX_LENGTH)
  .regex(IDENTIFIER_REGEX, 'must be snake_case: lowercase letters, digits, underscores');

export function isValidIdentifier(value: string): boolean {
  return identifierSchema.safeParse(value).success;
}
