import { FieldMetadataEntity, FileEntity, ObjectMetadataEntity, WorkspaceEntity, WorkspaceMemberEntity } from '@saasly/database';
import { FieldMetadataType } from '@saasly/shared';
import { dataSource, workspaceDataSourceCache } from '../../lib/db.js';
import { storageDriver } from '../../lib/storage.js';
import { logger } from '../../lib/logger.js';

const TRASH_RETENTION_DAYS = 30;
const FILE_RETENTION_DAYS = 30;
const LOG_RETENTION_DAYS = 90;

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

/** File URLs are stored as the host-relative `/files/:id` path (mirrors apps/api/src/modules/file/file.service.ts). */
function fileIdFromUrl(url: unknown): string | null {
  if (typeof url !== 'string') return null;
  const match = /^\/files\/([^/]+)$/.exec(url);
  return match?.[1] ?? null;
}

/**
 * Hard-deletes soft-deleted record rows (any object, any workspace) past the retention window —
 * soft-deleted rows otherwise sit forever (`deleteRecord`'s `softRemove` path has no follow-up
 * hard-delete anywhere in the app). One `DELETE` per object table, not per row.
 */
export async function runTrashCleanup(): Promise<void> {
  const cutoff = daysAgo(TRASH_RETENTION_DAYS);
  const workspaces = await dataSource.getRepository(WorkspaceEntity).find();
  const schemaByWorkspaceId = new Map(workspaces.map((w) => [w.id, w.databaseSchema]));
  const objects = await dataSource.getRepository(ObjectMetadataEntity).find();

  let totalDeleted = 0;
  for (const object of objects) {
    const schema = schemaByWorkspaceId.get(object.workspaceId);
    if (!schema) continue;
    const workspaceDs = await workspaceDataSourceCache.getWorkspaceDataSource(object.workspaceId);
    const deleted: unknown[] = await workspaceDs.query(
      `DELETE FROM "${schema}"."${object.namePlural}" WHERE "deleted_at" IS NOT NULL AND "deleted_at" < $1 RETURNING id`,
      [cutoff],
    );
    totalDeleted += deleted.length;
  }
  logger.info({ deleted: totalDeleted, cutoff }, '[housekeeping] trash cleanup complete');
}

/**
 * Hard-deletes `FileEntity` rows (+ their storage blob) older than the retention window that
 * aren't referenced anywhere — workspace logos, workspace-member avatars, or any FILES-type field
 * value across every workspace's tables. There's no FK from files to what references them, so
 * every reference source has to be scanned explicitly (see gap analysis: file lifecycle has no
 * orphan-tracking today).
 */
export async function runFileCleanup(): Promise<void> {
  const cutoff = daysAgo(FILE_RETENTION_DAYS);
  const referencedIds = new Set<string>();

  const workspaces = await dataSource.getRepository(WorkspaceEntity).find();
  for (const workspace of workspaces) {
    const id = fileIdFromUrl(workspace.logoUrl);
    if (id) referencedIds.add(id);
  }
  const members = await dataSource.getRepository(WorkspaceMemberEntity).find();
  for (const member of members) {
    const id = fileIdFromUrl(member.avatarUrl);
    if (id) referencedIds.add(id);
  }

  const schemaByWorkspaceId = new Map(workspaces.map((w) => [w.id, w.databaseSchema]));
  const objectsById = new Map((await dataSource.getRepository(ObjectMetadataEntity).find()).map((o) => [o.id, o]));
  const filesFields = await dataSource
    .getRepository(FieldMetadataEntity)
    .findBy({ type: FieldMetadataType.FILES, isActive: true });

  for (const field of filesFields) {
    const object = objectsById.get(field.objectMetadataId);
    const schema = object && schemaByWorkspaceId.get(object.workspaceId);
    if (!object || !schema) continue;

    const workspaceDs = await workspaceDataSourceCache.getWorkspaceDataSource(object.workspaceId);
    const rows: { value: unknown }[] = await workspaceDs.query(
      `SELECT "${field.name}" AS value FROM "${schema}"."${object.namePlural}" WHERE "${field.name}" IS NOT NULL`,
    );
    for (const row of rows) {
      const entries = Array.isArray(row.value) ? row.value : [];
      for (const entry of entries) {
        const id = fileIdFromUrl(typeof entry === 'string' ? entry : (entry as { url?: unknown })?.url);
        if (id) referencedIds.add(id);
      }
    }
  }

  const staleFiles = await dataSource
    .getRepository(FileEntity)
    .createQueryBuilder('f')
    .where('f.created_at < :cutoff', { cutoff })
    .getMany();

  let deleted = 0;
  for (const file of staleFiles) {
    if (referencedIds.has(file.id)) continue;
    await storageDriver.delete(file.path).catch((err) => logger.error({ err, fileId: file.id }, '[housekeeping] blob delete failed'));
    await dataSource.getRepository(FileEntity).delete({ id: file.id });
    deleted += 1;
  }
  logger.info({ deleted, scanned: staleFiles.length, cutoff }, '[housekeeping] file cleanup complete');
}

/** Hard-deletes audit-log entries past the retention window — currently these accumulate forever. */
export async function runLogRetention(): Promise<void> {
  const cutoff = daysAgo(LOG_RETENTION_DAYS);
  const deleted: unknown[] = await dataSource.query(
    `DELETE FROM "core"."audit_logs" WHERE "created_at" < $1 RETURNING id`,
    [cutoff],
  );
  logger.info({ deleted: deleted.length, cutoff }, '[housekeeping] audit log retention complete');
}

/**
 * Hard-deletes expired or revoked refresh tokens — once a token is expired or revoked it has zero
 * downstream consumers (auth.service.ts already rejects it), so no grace period is needed.
 */
export async function runSessionCleanup(): Promise<void> {
  const now = new Date();
  const deleted: unknown[] = await dataSource.query(
    `DELETE FROM "core"."refresh_tokens" WHERE "expires_at" < $1 OR "revoked_at" IS NOT NULL RETURNING id`,
    [now],
  );
  logger.info({ deleted: deleted.length }, '[housekeeping] expired-session cleanup complete');
}
