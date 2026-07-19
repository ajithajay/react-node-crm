import { createHmac } from 'node:crypto';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { TokenType } from '@saasly/shared';
import { env } from './config.js';

/** Per-type secret, derived from the base JWT_SECRET. */
function deriveSecret(type: TokenType): string {
  return createHmac('sha256', env.JWT_SECRET).update(type).digest('hex');
}

const TTL_BY_TYPE: Record<TokenType, string> = {
  [TokenType.ACCESS]: env.ACCESS_TOKEN_TTL,
  [TokenType.REFRESH]: env.REFRESH_TOKEN_TTL,
  [TokenType.LOGIN]: env.LOGIN_TOKEN_TTL,
  [TokenType.WORKSPACE_AGNOSTIC]: env.WORKSPACE_AGNOSTIC_TOKEN_TTL,
  [TokenType.API_KEY]: '3650d',
  [TokenType.EMAIL_VERIFICATION]: env.EMAIL_VERIFICATION_TOKEN_TTL,
  [TokenType.PASSWORD_RESET]: env.PASSWORD_RESET_TOKEN_TTL,
  [TokenType.TWO_FACTOR_CHALLENGE]: env.TWO_FACTOR_CHALLENGE_TOKEN_TTL,
};

export interface TokenPayload {
  sub: string;
  type: TokenType;
  workspaceId?: string;
  userWorkspaceId?: string;
}

export class TokenError extends Error {
  constructor(message = 'Invalid or expired token') {
    super(message);
    this.name = 'TokenError';
  }
}

export function signToken(payload: TokenPayload): string {
  const options: SignOptions = { expiresIn: TTL_BY_TYPE[payload.type] as SignOptions['expiresIn'] };
  return jwt.sign(payload, deriveSecret(payload.type), options);
}

export function verifyToken<T extends TokenPayload = TokenPayload>(
  token: string,
  expectedType: TokenType,
): T {
  let decoded: T;
  try {
    decoded = jwt.verify(token, deriveSecret(expectedType)) as T;
  } catch {
    throw new TokenError();
  }
  if (decoded.type !== expectedType) throw new TokenError('Unexpected token type');
  return decoded;
}
