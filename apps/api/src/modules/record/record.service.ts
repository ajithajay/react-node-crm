import { FieldMetadataEntity, ObjectMetadataEntity } from '@saasly/database';
import type { RecordListQuery } from '@saasly/shared';
import { dataSource } from '../../lib/db.js';
import { workspaceDataSourceCache } from '../../lib/workspace-data-source.js';
import { applyRecordListQuery } from '../../lib/query-parser.js';
import { AppError, NotFoundError } from '../../lib/errors.js';
import { decodeRecord, encodeRecordInput } from './record-field-codec.js';
import { buildCsvColumns, csvToRecordBodies, recordsToCsv } from './record-csv.js';
import {
  assertObjectAccess,
  resolveActorRole,
  resolveFieldRestrictions,
  type ActorRole,
} from './record-permission.js';

const objectRepo = () => dataSource.getRepository(ObjectMetadataEntity);
const fieldRepo = () => dataSource.getRepository(FieldMetadataEntity);

export interface RecordListResult {
  records: Record<string, unknown>[];
  page: number;
  pageSize: number;
  total: number;
}

async function resolveObject(workspaceId: string, objectNamePlural: string): Promise<ObjectMetadataEntity> {
  const object = await objectRepo().findOneBy({ workspaceId, namePlural: objectNamePlural, isActive: true });
  if (!object) throw new NotFoundError('Object not found');
  return object;
}

async function resolveActiveFields(workspaceId: string, objectMetadataId: string): Promise<FieldMetadataEntity[]> {
  return fieldRepo().findBy({ workspaceId, objectMetadataId, isActive: true });
}

async function getRepository(workspaceId: string, object: ObjectMetadataEntity) {
  const workspaceDataSource = await workspaceDataSourceCache.getWorkspaceDataSource(workspaceId);
  return workspaceDataSource.getRepository(object.nameSingular);
}

export async function listRecords(
  workspaceId: string,
  userId: string,
  objectNamePlural: string,
  query: RecordListQuery,
): Promise<RecordListResult> {
  const object = await resolveObject(workspaceId, objectNamePlural);
  const actor = await resolveActorRole(userId, workspaceId);
  await assertObjectAccess(actor, object.id, 'read');

  const fields = await resolveActiveFields(workspaceId, object.id);
  const { restrictedForRead } = await resolveFieldRestrictions(
    actor,
    fields.map((f) => f.id),
  );

  const repository = await getRepository(workspaceId, object);
  const alias = object.nameSingular;
  const qb = repository.createQueryBuilder(alias);
  const { page, pageSize } = applyRecordListQuery(qb, alias, fields, query);

  const [rows, total] = await qb.getManyAndCount();
  return {
    records: rows.map((row) => decodeRecord(fields, row as Record<string, unknown>, restrictedForRead)),
    page,
    pageSize,
    total,
  };
}

export async function getRecord(
  workspaceId: string,
  userId: string,
  objectNamePlural: string,
  id: string,
): Promise<Record<string, unknown>> {
  const object = await resolveObject(workspaceId, objectNamePlural);
  const actor = await resolveActorRole(userId, workspaceId);
  await assertObjectAccess(actor, object.id, 'read');

  const fields = await resolveActiveFields(workspaceId, object.id);
  const { restrictedForRead } = await resolveFieldRestrictions(
    actor,
    fields.map((f) => f.id),
  );

  const repository = await getRepository(workspaceId, object);
  const row = await repository.findOneBy({ id });
  if (!row) throw new NotFoundError('Record not found');

  return decodeRecord(fields, row as Record<string, unknown>, restrictedForRead);
}

/** ACTOR columns for created_by/updated_by — system-stamped from the caller's workspace membership. */
function actorStamp(actor: ActorRole): Record<string, unknown> {
  const name = `${actor.member.firstName} ${actor.member.lastName}`.trim();
  return { source: 'WORKSPACE_MEMBER', workspace_member_id: actor.member.id, name, context: null };
}

export async function createRecord(
  workspaceId: string,
  userId: string,
  objectNamePlural: string,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const object = await resolveObject(workspaceId, objectNamePlural);
  const actor = await resolveActorRole(userId, workspaceId);
  await assertObjectAccess(actor, object.id, 'update');

  const fields = await resolveActiveFields(workspaceId, object.id);
  const { restrictedForRead, restrictedForWrite } = await resolveFieldRestrictions(
    actor,
    fields.map((f) => f.id),
  );

  const data = encodeRecordInput(fields, body, restrictedForWrite);
  const stamp = actorStamp(actor);
  for (const [suffix, value] of Object.entries(stamp)) {
    data[`created_by_${suffix}`] = value;
    data[`updated_by_${suffix}`] = value;
  }

  const repository = await getRepository(workspaceId, object);
  const saved = await repository.save(repository.create(data));
  return decodeRecord(fields, saved as Record<string, unknown>, restrictedForRead);
}

export async function updateRecord(
  workspaceId: string,
  userId: string,
  objectNamePlural: string,
  id: string,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const object = await resolveObject(workspaceId, objectNamePlural);
  const actor = await resolveActorRole(userId, workspaceId);
  await assertObjectAccess(actor, object.id, 'update');

  const fields = await resolveActiveFields(workspaceId, object.id);
  const { restrictedForRead, restrictedForWrite } = await resolveFieldRestrictions(
    actor,
    fields.map((f) => f.id),
  );

  const repository = await getRepository(workspaceId, object);
  const existing = await repository.findOneBy({ id });
  if (!existing) throw new NotFoundError('Record not found');

  const data = encodeRecordInput(fields, body, restrictedForWrite);
  const stamp = actorStamp(actor);
  for (const [suffix, value] of Object.entries(stamp)) data[`updated_by_${suffix}`] = value;

  const saved = await repository.save(repository.merge(existing, data));
  return decodeRecord(fields, saved as Record<string, unknown>, restrictedForRead);
}

export async function deleteRecord(
  workspaceId: string,
  userId: string,
  objectNamePlural: string,
  id: string,
  hard: boolean,
): Promise<void> {
  const object = await resolveObject(workspaceId, objectNamePlural);
  const actor = await resolveActorRole(userId, workspaceId);
  await assertObjectAccess(actor, object.id, hard ? 'destroy' : 'softDelete');

  const repository = await getRepository(workspaceId, object);
  const existing = await repository.findOneBy({ id });
  if (!existing) throw new NotFoundError('Record not found');

  if (hard) await repository.remove(existing);
  else await repository.softRemove(existing);
}

/**
 * Synchronous CSV export/import (no `csv-export`/`csv-import` worker job, despite the queue names
 * being reserved in solution-approach.md §7) — a deliberate v1 scope cut, not an oversight: a queued
 * job needs a place to deliver the result (a file the user downloads once it's ready, notifications,
 * etc.), which is real additional infrastructure this pass didn't need to justify for reasonably-sized
 * CSVs. Both directions are capped and documented below; revisit with the queue if a real workspace's
 * dataset outgrows a single synchronous request.
 */
const CSV_EXPORT_MAX_ROWS = 5000;
const CSV_IMPORT_MAX_ROWS = 2000;

export async function exportRecordsCsv(
  workspaceId: string,
  userId: string,
  objectNamePlural: string,
  query: RecordListQuery,
): Promise<{ filename: string; csv: string }> {
  const object = await resolveObject(workspaceId, objectNamePlural);
  const actor = await resolveActorRole(userId, workspaceId);
  await assertObjectAccess(actor, object.id, 'read');

  const fields = await resolveActiveFields(workspaceId, object.id);
  const { restrictedForRead } = await resolveFieldRestrictions(
    actor,
    fields.map((f) => f.id),
  );

  const repository = await getRepository(workspaceId, object);
  const alias = object.nameSingular;
  const qb = repository.createQueryBuilder(alias);
  applyRecordListQuery(qb, alias, fields, { ...query, page: 1, pageSize: CSV_EXPORT_MAX_ROWS });

  const rows = await qb.getMany();
  const decoded = rows.map((row) => decodeRecord(fields, row as Record<string, unknown>, restrictedForRead));
  const columns = buildCsvColumns(fields, restrictedForRead);

  return { filename: `${object.namePlural}.csv`, csv: recordsToCsv(columns, decoded) };
}

export interface ImportSummary {
  created: number;
  failed: number;
  errors: { row: number; message: string }[];
}

export async function importRecordsCsv(
  workspaceId: string,
  userId: string,
  objectNamePlural: string,
  csvText: string,
): Promise<ImportSummary> {
  const object = await resolveObject(workspaceId, objectNamePlural);
  const actor = await resolveActorRole(userId, workspaceId);
  await assertObjectAccess(actor, object.id, 'update');

  const fields = await resolveActiveFields(workspaceId, object.id);
  const { restrictedForRead, restrictedForWrite } = await resolveFieldRestrictions(
    actor,
    fields.map((f) => f.id),
  );

  const columns = buildCsvColumns(fields, restrictedForRead);
  const bodies = csvToRecordBodies(columns, csvText);
  if (bodies.length > CSV_IMPORT_MAX_ROWS) {
    throw new AppError(`CSV has ${bodies.length} rows; the import limit is ${CSV_IMPORT_MAX_ROWS}`, 400);
  }

  const repository = await getRepository(workspaceId, object);
  const stamp = actorStamp(actor);
  const summary: ImportSummary = { created: 0, failed: 0, errors: [] };

  for (let i = 0; i < bodies.length; i += 1) {
    try {
      const data = encodeRecordInput(fields, bodies[i]!, restrictedForWrite);
      for (const [suffix, value] of Object.entries(stamp)) {
        data[`created_by_${suffix}`] = value;
        data[`updated_by_${suffix}`] = value;
      }
      await repository.save(repository.create(data));
      summary.created += 1;
    } catch (err) {
      summary.failed += 1;
      // +2: 1-indexed, plus the header row.
      summary.errors.push({ row: i + 2, message: err instanceof Error ? err.message : 'Unknown error' });
    }
  }

  return summary;
}
