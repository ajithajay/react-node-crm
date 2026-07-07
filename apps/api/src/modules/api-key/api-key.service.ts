import { randomUUID } from 'node:crypto';
import { ApiKeyEntity, RoleEntity } from '@saasly/database';
import { TokenType, type CreateApiKeyRequest } from '@saasly/shared';
import { dataSource } from '../../lib/db.js';
import { sha256Hex } from '../../lib/crypto.js';
import { signToken } from '../../lib/jwt.js';
import { AppError, NotFoundError } from '../../lib/errors.js';
import { record } from '../audit-log/audit-log.service.js';

const apiKeyRepo = () => dataSource.getRepository(ApiKeyEntity);
const roleRepo = () => dataSource.getRepository(RoleEntity);

export interface ApiKeySummary {
  id: string;
  name: string;
  roleId: string | null;
  isRevoked: boolean;
  isExpired: boolean;
  expiresAt: Date | null;
  createdAt: Date;
}

function toSummary(apiKey: ApiKeyEntity): ApiKeySummary {
  return {
    id: apiKey.id,
    name: apiKey.name,
    roleId: apiKey.roleId,
    isRevoked: apiKey.revokedAt !== null,
    isExpired: apiKey.expiresAt !== null && apiKey.expiresAt.getTime() < Date.now(),
    expiresAt: apiKey.expiresAt,
    createdAt: apiKey.createdAt,
  };
}

/** `YYYY-MM-DD` -> end-of-day UTC, so a key stays valid through its whole expiry date. */
function parseExpiresAt(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(`${value}T23:59:59.999Z`);
  if (Number.isNaN(date.getTime())) throw new AppError('Invalid expiry date');
  if (date.getTime() < Date.now()) throw new AppError('Expiry date must be in the future');
  return date;
}

export async function listApiKeys(workspaceId: string): Promise<ApiKeySummary[]> {
  const keys = await apiKeyRepo().findBy({ workspaceId });
  return keys.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).map(toSummary);
}

/**
 * The signed JWT (TokenType.API_KEY) is the raw secret — it's returned to the caller exactly once.
 * Only its hash is persisted, matching the invitation-token pattern. Wiring it up as a bearer
 * credential on the generic record REST API is deferred to Phase 6, which is the first thing that
 * actually needs to authenticate against it (same "stored, not yet enforced" call as object/field
 * permissions in Phase 5e).
 */
export async function createApiKey(
  workspaceId: string,
  actorUserId: string,
  input: CreateApiKeyRequest,
): Promise<{ apiKey: ApiKeySummary; token: string }> {
  if (input.roleId) {
    const role = await roleRepo().findOneBy({ id: input.roleId, workspaceId });
    if (!role) throw new NotFoundError('Role not found');
  }

  const id = randomUUID();
  const token = signToken({ sub: id, type: TokenType.API_KEY, workspaceId });

  const apiKey = await apiKeyRepo().save(
    apiKeyRepo().create({
      id,
      workspaceId,
      name: input.name,
      roleId: input.roleId ?? null,
      tokenHash: sha256Hex(token),
      expiresAt: parseExpiresAt(input.expiresAt),
    }),
  );

  await record(workspaceId, actorUserId, 'api_key.created', { name: apiKey.name });
  return { apiKey: toSummary(apiKey), token };
}

export async function revokeApiKey(workspaceId: string, apiKeyId: string, actorUserId: string): Promise<void> {
  const apiKey = await apiKeyRepo().findOneBy({ id: apiKeyId, workspaceId });
  if (!apiKey) throw new NotFoundError('API key not found');

  if (!apiKey.revokedAt) {
    apiKey.revokedAt = new Date();
    await apiKeyRepo().save(apiKey);
    await record(workspaceId, actorUserId, 'api_key.revoked', { name: apiKey.name });
  }
}
