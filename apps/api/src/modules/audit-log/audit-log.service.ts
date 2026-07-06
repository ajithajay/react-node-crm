import { In } from 'typeorm';
import { AuditLogEntity, UserEntity } from '@saasly/database';
import type { AuditLogAction, AuditLogQuery } from '@saasly/shared';
import { dataSource } from '../../lib/db.js';

const auditLogRepo = () => dataSource.getRepository(AuditLogEntity);

/** Fire-and-forget from the caller's perspective, but awaited so failures surface in logs. */
export async function record(
  workspaceId: string,
  actorUserId: string | null,
  action: AuditLogAction,
  metadata?: Record<string, unknown>,
): Promise<void> {
  await auditLogRepo().save(
    auditLogRepo().create({ workspaceId, actorUserId, action, metadata: metadata ?? null }),
  );
}

export interface AuditLogEntry {
  id: string;
  action: string;
  actorEmail: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

export interface AuditLogPage {
  entries: AuditLogEntry[];
  page: number;
  pageSize: number;
  total: number;
}

export async function list(workspaceId: string, query: AuditLogQuery): Promise<AuditLogPage> {
  const qb = auditLogRepo()
    .createQueryBuilder('log')
    .where('log.workspace_id = :workspaceId', { workspaceId })
    .orderBy('log.created_at', 'DESC')
    .skip((query.page - 1) * query.pageSize)
    .take(query.pageSize);

  if (query.action) qb.andWhere('log.action = :action', { action: query.action });

  const [logs, total] = await qb.getManyAndCount();

  const actorIds = [...new Set(logs.map((l) => l.actorUserId).filter((id): id is string => id !== null))];
  const actors = actorIds.length ? await dataSource.getRepository(UserEntity).findBy({ id: In(actorIds) }) : [];
  const actorEmailById = new Map(actors.map((u) => [u.id, u.email]));

  return {
    entries: logs.map((log) => ({
      id: log.id,
      action: log.action,
      actorEmail: log.actorUserId ? (actorEmailById.get(log.actorUserId) ?? null) : null,
      metadata: log.metadata,
      createdAt: log.createdAt,
    })),
    page: query.page,
    pageSize: query.pageSize,
    total,
  };
}
