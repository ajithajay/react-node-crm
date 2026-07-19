/** JWT token kinds. Each is signed with a per-type derived secret. */
export const TokenType = {
  ACCESS: 'ACCESS',
  REFRESH: 'REFRESH',
  LOGIN: 'LOGIN',
  WORKSPACE_AGNOSTIC: 'WORKSPACE_AGNOSTIC',
  API_KEY: 'API_KEY',
  EMAIL_VERIFICATION: 'EMAIL_VERIFICATION',
  PASSWORD_RESET: 'PASSWORD_RESET',
  TWO_FACTOR_CHALLENGE: 'TWO_FACTOR_CHALLENGE',
} as const;
export type TokenType = (typeof TokenType)[keyof typeof TokenType];
